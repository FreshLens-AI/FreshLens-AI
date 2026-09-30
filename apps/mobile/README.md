# FreshLens vendor mobile

Expo mobile client for authenticated vendor workflows. Supabase sessions are
stored in chunked Expo SecureStore values, and only signed `vendor` identities
with a valid `tenant_id` can enter the application.

Vendors invited by a platform admin receive a `freshlens://set-password` link.
The login screen also offers **Forgot password?**; both email flows open a
password form in an installed mobile build, then return to sign in. Configure
this redirect URL in Supabase Auth and use a development or release build rather
than Expo Go for email-link testing.

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

## Push notifications and EAS builds

After sign-in, the app registers its Expo push token with `POST /api/v1/devices`. The worker then pushes, through Expo Push and FCM, when a scan completes or fails and when a spoilage alert is raised. Tapping a push opens History or Alerts, and the screen then refetches from the API. Remote push does not work in Expo Go, so use an EAS or dev build.

- EAS project: `1397c863-…` (`extra.eas.projectId` in `app.json`). Android package: `com.sathurshnau.mobile`.
- Firebase project: `freshlense-dc779`. Android app ID: `1:1052849430249:android:754cca2b042ba8dd205a78`.

`google-services.json` is gitignored. To set up a machine or EAS project once:

```bash
firebase apps:sdkconfig ANDROID 1:1052849430249:android:754cca2b042ba8dd205a78 \
  --project freshlense-dc779 -o google-services.json
eas env:set --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json \
  --environment preview --environment development --visibility secret
eas credentials -p android   # upload the Google Service Account key for FCM V1 (Firebase console → Service accounts)
```

To build an installable APK (the `preview` profile points at the demo VPS API):

```bash
eas build -p android --profile preview
```

## Checks

```bash
npm test
npm run typecheck
npx expo-doctor
```
