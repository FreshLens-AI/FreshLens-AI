# FreshLens vendor mobile

Expo mobile client for authenticated vendor workflows. Supabase sessions are
stored in chunked Expo SecureStore values, and only signed `vendor` identities
with a valid `tenant_id` can enter the application.

After sign-in, vendors can open the scan flow: camera capture → quantity ≥ 1 →
multipart submit (when `POST /api/v1/scans` is available) → status poll.

```bash
npm install
cp .env.example .env.local
npm start
```

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
