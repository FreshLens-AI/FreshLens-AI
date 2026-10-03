# FreshLens submission

The submission folder contains the source ZIP (or GitHub link), three user-manual
PDFs and `FreshLens.apk`. Keep generated manuals, APKs and archives outside Git.
This repository provides source, tests, build scripts and configuration templates.

## Requirements and configuration

Use Bash on Linux/macOS or Windows WSL, Node.js **22.13+ (22.x)**, Python **3.12**
with venv support, and running Docker. Builds also require Docker Compose v2.
Internet access is needed for dependencies and uncached Docker layers.

Before building, copy each template only if its destination does not exist:

```bash
cp -n .env.example .env
cp -n apps/web/.env.example apps/web/.env.local
cp -n apps/mobile/.env.example apps/mobile/.env.local
```

Set the Supabase URL, publishable key and API address; physical phones need a
reachable address. See [authentication setup](../docs/authentication.md).
Real environment files and signing credentials are excluded from the source ZIP.

## Tests

```bash
bash scripts/test.sh
bash scripts/test.sh --integration
```

The script installs dependencies and checks repository structure, API/ML tests,
web/mobile tests and types, web lint, and PostgreSQL RLS/runtime-role isolation.
Integration adds real HTTP, JWT/JWKS, PostgreSQL, Redis and Celery checks with a
stub classifier. Tests use disposable services and synthetic auth settings;
model accuracy, browser and native phone evidence require separate validation.
See [the evidence guide](../docs/test-evidence-guide.md).

## Builds

```bash
bash scripts/build.sh
bash scripts/build.sh --web-only
bash scripts/build.sh --apk
```

Default outputs are `apps/web/.next`, local Docker images
`freshlens-submission-{api,worker,scheduler}`, and Android JS/assets under the
printed results directory. Both checked-in model checkpoints are required.
Run the web output with `npm --prefix apps/web start`; builds do not start services.

`--web-only` needs no Docker. `--apk` additionally builds an installable preview
APK with local EAS Build. It requires EAS CLI, Expo login/signing credentials,
JDK, Android SDK/NDK (`ANDROID_HOME`), and `apps/mobile/google-services.json` or
an absolute `GOOGLE_SERVICES_JSON` path. Local builds contact Expo for project
verification and credentials; see [Expo requirements](https://docs.expo.dev/build-reference/local-builds/).
The default JS export can report a missing Firebase config; APK mode requires it.

## Results and packaging

Both scripts work from any directory, require `scripts/submission-common.sh`,
and save logs and a pass/fail summary under `runs/submission/`; tests also save
Python JUnit XML. Exit 0 means success. `--no-install` reuses dependencies; tests
can select a Python 3.12 venv via `FRESHLENS_PYTHON=/absolute/path/to/bin/python`.

From a Git checkout, run `python3 scripts/package-submission.py` to create
`runs/submission/freshlens-source-code-and-scripts.zip`. It packages tracked
working-copy files (including staged additions), models and a manifest, excluding
local credentials, dependencies and generated output. Extracted source can run
tests/builds without Git. Upload the ZIP alongside the manuals and APK.
