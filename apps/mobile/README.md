# FreshLens vendor mobile

Expo mobile client for authenticated vendor workflows. Supabase sessions are
stored in chunked Expo SecureStore values, and only signed `vendor` identities
with a valid `tenant_id` can enter the application.

```bash
npm install
cp .env.example .env.local
npm start
```

The shared API helper validates the session and sends
`Authorization: Bearer <JWT>` without ever sending a client-selected tenant ID.
For a physical phone, replace `localhost` in `EXPO_PUBLIC_API_URL` with the
development machine's LAN address. Push-token registration remains part of the
scan/alert notification endpoint work; the authentication session is already the
trusted source of its tenant when that endpoint lands.
See [`../../docs/authentication.md`](../../docs/authentication.md) for project and
account provisioning.

## Checks

```bash
npm test
npm run typecheck
npx expo-doctor
```
