#!/usr/bin/env bash
# Push FreshLens admin Site URL + redirect allow-list to hosted Supabase Auth.
# Requires a personal access token from the account that owns project ygeywiukeeewfgwdssvs:
#   https://supabase.com/dashboard/account/tokens
set -euo pipefail
REF="${SUPABASE_PROJECT_REF:-ygeywiukeeewfgwdssvs}"
TOKEN="${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN (supabase.com/dashboard/account/tokens)}"
SITE_URL="${SITE_URL:-https://freshlens-admin.vercel.app}"
ADD_URLS=(
  "https://freshlens-admin.vercel.app"
  "https://freshlens-admin.vercel.app/**"
  "http://localhost:3000"
  "http://localhost:3000/**"
  "http://127.0.0.1:3000"
  "http://127.0.0.1:3000/**"
)

python3 - "$REF" "$TOKEN" "$SITE_URL" "${ADD_URLS[@]}" <<'PY'
import json, sys, urllib.request
ref, token, site_url, *add = sys.argv[1:]
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
}
base = f"https://api.supabase.com/v1/projects/{ref}/config/auth"
req = urllib.request.Request(base, headers=headers)
with urllib.request.urlopen(req) as resp:
    cfg = json.loads(resp.read())
print("BEFORE site_url:", cfg.get("site_url"))
print("BEFORE uri_allow_list:", cfg.get("uri_allow_list"))
current = [u.strip() for u in (cfg.get("uri_allow_list") or "").split(",") if u.strip()]
for u in add:
    if u not in current:
        current.append(u)
payload = json.dumps({"site_url": site_url, "uri_allow_list": ",".join(current)}).encode()
req = urllib.request.Request(base, data=payload, headers=headers, method="PATCH")
with urllib.request.urlopen(req) as resp:
    out = json.loads(resp.read())
print("AFTER site_url:", out.get("site_url"))
print("AFTER uri_allow_list:", out.get("uri_allow_list"))
print("OK")
PY
