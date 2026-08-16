# FreshLens vendor mobile

Expo mobile client for authenticated vendor workflows. Supabase sessions are
stored in chunked Expo SecureStore values, and only signed `vendor` identities
with a valid `tenant_id` can enter the application.

After sign-in, vendors can open the scan flow: camera capture → quantity ≥ 1 →
multipart submit (when `POST /api/v1/scans` is available) → status poll.

```bash
npm install
cp .env.example .env.local
npm run env:check
npm start
```

The variable names must retain their complete `EXPO_PUBLIC_` prefix. Expo only
inlines statically referenced client variables with that prefix; root-level
names such as `SUPABASE_URL` are not available to the application bundle. After
changing an env file, fully reload Expo Go. If an old bundle remains open,
restart Metro with `npx expo start --clear`.

`localhost` in `EXPO_PUBLIC_API_URL` refers to the phone when the application is
opened on a physical device. Set it to the development machine's LAN address,
for example `http://10.25.234.137:8000`, and confirm that `/health` opens from
the phone before submitting a scan.

The shared API helper validates the session and sends
`Authorization: Bearer <JWT>` without ever sending a client-selected tenant ID.
For a physical phone, replace `localhost` in `EXPO_PUBLIC_API_URL` with the
development machine's LAN address. See
[`../../docs/authentication.md`](../../docs/authentication.md) for project and
account provisioning.

## Checks

```bash
npm test
npm run typecheck
npx expo-doctor
```
