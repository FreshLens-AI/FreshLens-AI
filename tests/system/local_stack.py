"""Disposable real services for API integration and local performance tests."""
from contextlib import ExitStack
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import threading
import time
from uuid import uuid4

from cryptography.hazmat.primitives.asymmetric import rsa
import httpx
import jwt
import psycopg
from redis import Redis
from redis.exceptions import ConnectionError as RedisConnectionError

ROOT = Path(__file__).resolve().parents[2]


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class LocalStack:
    """No application overrides: real HTTP, JWT verification, SQL, queue and worker."""

    def __init__(self, output, performance=False):
        self.output = Path(output).resolve()
        self.performance = performance
        self.resources = ExitStack()
        self.config = {}

    def __enter__(self):
        try:
            self.start()
            return self
        except BaseException:
            self.resources.close()
            raise

    def __exit__(self, *args):
        self.resources.close()

    def docker(self, *args):
        return subprocess.check_output(["docker", *args], text=True, stderr=subprocess.STDOUT).strip()

    def container(self, image, port, *args):
        name = f"freshlens-evidence-{uuid4().hex[:10]}"
        self.docker("run", "--detach", "--rm", "--name", name,
                    "-p", f"127.0.0.1::{port}", *args, image)
        self.resources.callback(subprocess.run, ["docker", "rm", "-f", name],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        address = self.docker("port", name, str(port))
        return name, int(address.rsplit(":", 1)[1])

    def process(self, command, cwd, env, name):
        log = self.resources.enter_context((self.output / f"{name}.log").open("w"))
        process = subprocess.Popen(command, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT)
        def stop():
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
        self.resources.callback(stop)
        return process

    def start(self):
        self.output.mkdir(parents=True, exist_ok=True)
        print("Starting disposable PostgreSQL 16 + Redis; host ports bind only to loopback.", flush=True)
        _, pg_port = self.container("postgres:16.14-alpine", 5432,
                                   "--tmpfs", "/var/lib/postgresql/data",
                                   "-e", "POSTGRES_USER=freshlens", "-e", "POSTGRES_PASSWORD=freshlens",
                                   "-e", "POSTGRES_DB=freshlens_test")
        owner_dsn = f"postgresql://freshlens:freshlens@127.0.0.1:{pg_port}/freshlens_test"
        for attempt in range(60):
            try:
                with psycopg.connect(owner_dsn, connect_timeout=1) as db:
                    db.execute("select 1")
                break
            except psycopg.OperationalError:
                if attempt == 59:
                    raise
                time.sleep(0.5)
        with psycopg.connect(owner_dsn, autocommit=True) as db:
            files = [ROOT / "infra/db/local/0000_supabase_compat.sql",
                     *sorted((ROOT / "infra/db/migrations").glob("*.sql")),
                     ROOT / "infra/db/local/0020_runtime_login.sql"]
            for path in files:
                db.execute(path.read_text())
            self.seed(db)

        _, redis_port = self.container("redis:7.4-alpine", 6379, "--tmpfs", "/data")
        redis_url = f"redis://127.0.0.1:{redis_port}/0"
        redis = Redis.from_url(redis_url)
        self.resources.callback(redis.close)
        for attempt in range(60):
            try:
                redis.ping()
                break
            except RedisConnectionError:
                if attempt == 59:
                    raise
                time.sleep(0.2)

        # Local identity-provider fixture. The application's real verifier fetches
        # JWKS over HTTP and validates signatures, expiry, issuer and claims.
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        public_key = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))
        public_key.update(kid="freshlens-local-test", alg="RS256", use="sig")
        jwks = json.dumps({"keys": [public_key]}).encode()
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path != "/auth/v1/.well-known/jwks.json":
                    self.send_error(404)
                    return
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(jwks)

            def log_message(self, *args):
                pass
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.resources.callback(server.server_close)
        self.resources.callback(server.shutdown)
        issuer_base = f"http://127.0.0.1:{server.server_port}"
        issued = int(time.time())
        for actor in self.config["actors"].values():
            claims = dict(sub=actor["user_id"], aud="authenticated", iat=issued,
                          exp=issued + 3600, iss=issuer_base + "/auth/v1", role="authenticated",
                          is_anonymous=False, session_id=str(uuid4()), app_role=actor["role"])
            if actor["tenant_id"]:
                claims["tenant_id"] = actor["tenant_id"]
            actor["token"] = jwt.encode(claims, key, algorithm="RS256", headers={"kid": public_key["kid"]})

        api_port = free_port()
        env = dict(os.environ, APP_ENV="test", DATABASE_SSL_MODE="disable",
                   DATABASE_URL=f"postgresql://freshlens_api_local:freshlens_api_local@127.0.0.1:{pg_port}/freshlens_test",
                   SUPABASE_URL=issuer_base, SUPABASE_JWT_AUDIENCE="authenticated",
                   SUPABASE_JWT_CLOCK_SKEW_SECONDS="0", REDIS_URL=redis_url,
                   CELERY_BROKER_URL=redis_url,
                   CELERY_RESULT_BACKEND=f"redis://127.0.0.1:{redis_port}/1",
                   CLASSIFIER="stub", SCAN_STORAGE_DIR=str(self.output / "scans"))
        self.process([sys.executable, "-m", "celery", "-A", "worker.app:app", "worker",
                      "--pool=solo", "--concurrency=1", "--loglevel=INFO", "--without-gossip",
                      "--without-mingle", "--without-heartbeat"], ROOT / "packages/ml", env, "worker")
        api = self.process([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1",
                            "--port", str(api_port), "--no-access-log"], ROOT / "apps/api", env, "api")
        base_url = f"http://127.0.0.1:{api_port}"
        with httpx.Client(base_url=base_url, trust_env=False, timeout=2) as client:
            for attempt in range(100):
                if api.poll() is not None:
                    raise RuntimeError(f"API failed to start. Inspect {self.output / 'api.log'}")
                try:
                    response = client.get("/api/v1/products", headers={
                        "Authorization": "Bearer " + self.config["actors"]["a"]["token"]})
                    if response.status_code == 200:
                        break
                except httpx.TransportError:
                    pass
                if attempt == 99:
                    raise RuntimeError("Authenticated API readiness check timed out")
                time.sleep(0.2)
        self.config.update(base_url=base_url, owner_dsn=owner_dsn, runtime_dsn=env["DATABASE_URL"],
                           redis_url=redis_url, scan_storage=env["SCAN_STORAGE_DIR"])
        config_path = self.output / "local-config.json"
        config_path.touch(mode=0o600)
        config_path.write_text(json.dumps(self.config))
        self.config_path = config_path
        metadata = dict(started=datetime.now(timezone.utc).isoformat(),
                        commit=subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
                        changes=subprocess.check_output(["git", "status", "--short"], cwd=ROOT, text=True),
                        api=base_url, postgres="16.14-alpine", redis="7.4-alpine", api_workers=1,
                        classifier="stub-v0", auth="local RS256/JWKS fixture; real application verification",
                        python=sys.version.split()[0])
        (self.output / "environment.json").write_text(json.dumps(metadata, indent=2))
        print("Ready: live HTTP + signed JWT/JWKS + restricted PostgreSQL role + Redis/Celery.", flush=True)
        print("Test substitutions: local identity provider; stub-v0 classifier (no model accuracy measurement).", flush=True)

    def seed(self, db):
        actors = {}
        for label in ("a", "b", "admin"):
            user_id = str(uuid4())
            tenant_id = str(uuid4()) if label != "admin" else None
            role = "vendor" if tenant_id else "platform_admin"
            db.execute("insert into auth.users(id,email) values (%s,%s)", (user_id, f"{label}@test.invalid"))
            if tenant_id:
                db.execute("insert into public.tenants(id,name) values (%s,%s)", (tenant_id, f"Test tenant {label}"))
            db.execute("insert into public.users(id,tenant_id,role,email,display_name) values (%s,%s,%s,%s,%s)",
                       (user_id, tenant_id, role, f"{label}@test.invalid", f"Test {label}"))
            actor = dict(user_id=user_id, tenant_id=tenant_id, role=role)
            if tenant_id:
                product_id, batch_id = str(uuid4()), str(uuid4())
                db.execute("insert into public.products(id,tenant_id,name,shelf_life_days,low_stock_threshold) values (%s,%s,%s,7,2)",
                           (product_id, tenant_id, "Tomato"))
                db.execute("insert into public.batches(id,tenant_id,product_id,quantity_received,quantity_remaining) values (%s,%s,%s,1000000,1000000)",
                           (batch_id, tenant_id, product_id))
                actor.update(product_id=product_id, batch_id=batch_id)
                if self.performance:
                    for index in range(20):
                        db.execute("""insert into public.scans(tenant_id,image_path,quantity,status,
                                   classification,freshness_score,model_version,product_id,batch_id)
                                   values (%s,%s,1,'completed','fresh',0.9,'synthetic-perf-fixture',%s,%s)""",
                                   (tenant_id, f"fixtures/{label}/scan-{index}.png", product_id, batch_id))
                    for index in range(5):
                        db.execute("""insert into public.alerts(tenant_id,type,severity,message,product_id,batch_id)
                                   values (%s,'aging','info',%s,%s,%s)""",
                                   (tenant_id, f"Synthetic performance alert {index}", product_id, batch_id))
            actors[label] = actor
        self.config["actors"] = actors
