# Auth

Owner area: **Auth** (`src/lib/auth/*`, `src/proxy.js`, `src/lib/viewer.js`, `src/components/LoginPanel.jsx`, `src/components/SignOutButton.jsx`, `src/app/login/*`, `src/app/api/auth/*`).

## Product rules

- **Only the team leader logs in.** Teammates never need an account.
- **Login uses a personal email.** SRM accounts can't sign in to third-party sites, so `@srmist.edu.in` logins are refused (in `LoginPanel` and again on the server). Every member's SRM email is collected on the registration form instead.
- **Two methods:** Google, or email + password. Email accounts must enter a 6-digit code before they can sign in (verification is *required*).
- **"Verified leader"** = `user.emailVerified === true` and the email is not `@srmist.edu.in` (`isVerifiedLeader` in `src/lib/viewer.js`). Only verified leaders see the registration form.
- One leader account ↔ one team (`team_members.user_id` is unique).

## Neon Auth setup (already done)

- Project PBJ, branch `main` (`br-muddy-wind-az4mtktp`), database `pbj`, provider Better Auth.
- Base URL: `https://ep-autumn-fog-azhzgnsk.neonauth.c-3.ap-southeast-1.aws.neon.tech/pbj/auth`
- Google: Neon's **shared** OAuth client (fine for development; replace before launch).
- Email/password: enabled, sign-up allowed, `require_email_verification: true`, method `otp`, codes sent on sign-up and on sign-in of an unverified account, auto sign-in after verification.
- Email sender: Neon's shared sender (`auth@mail.myneon.app`).
- Localhost allowed; no trusted production domain yet.

Inspect or change with the Neon MCP tools: `get_neon_auth_config`, `update_auth_email_and_password`, `add_auth_oauth_provider`, `add_auth_trusted_domain`, `update_auth_allow_localhost`. Always pass `project_id: winter-darkness-88202045` and the branch id.

## Code

| File | Role |
| --- | --- |
| `src/lib/auth/server.js` | `auth = createNeonAuth({ baseUrl, cookies: { secret } })`. Gives `.handler()`, `.middleware()`, `.getSession()`. |
| `src/app/api/auth/[...path]/route.js` | `export const { GET, POST, … } = auth.handler()`: proxies all auth calls. Don't add logic here. |
| `src/proxy.js` | `auth.middleware({ loginUrl: '/login' })`, `matcher: ['/register', '/dashboard/:path*']`. Redirects signed-out visitors and **completes Google sign-in**. |
| `src/lib/auth/client.js` | `authClient = createAuthClient()` (a Better Auth React client with the `emailOtp` plugin). |
| `src/lib/viewer.js` | `getViewer()`: session → upserts `users` → finds the leader's team. Use this in every server page/action instead of calling `auth.getSession()` directly. |
| `src/components/LoginPanel.jsx` | Email sign-in / create account, OTP step, then "or" + Google. |
| `src/components/SignOutButton.jsx` | `authClient.signOut()` then navigate. The navbar's door icon does the same (`LogoutButton` in `src/site.jsx`). |

### `getViewer()` shape

```js
null // signed out
{
  id,            // Neon Auth user id = users.id
  name, email,   // email lowercased
  image,
  emailVerified, // from Neon Auth
  collegeLogin,  // true if they signed in with an @srmist.edu.in address (not allowed to register)
  verified,      // emailVerified && !collegeLogin
  teamId,        // uuid or null
}
```

## Protecting a new route

1. Add it to `matcher` in `src/proxy.js` (e.g. `'/shop/:path*'`).
2. In the page: `const viewer = await getViewer(); if (!viewer) redirect('/login');` and add role/team checks you need. The proxy is the first gate; the page check is the backstop.
3. `export const dynamic = 'force-dynamic'`.

## Calling the auth client

The client sometimes **throws** (`AuthApiError`) instead of returning `{ error }`. Wrap every call:

```js
const { data, error } = await call(() => authClient.signIn.email({ email, password }));
```

`call()` lives in `LoginPanel.jsx`; move it to `src/lib/auth/client.js` if a second component needs it. Useful error codes: `INVALID_EMAIL_OR_PASSWORD` (401), `EMAIL_NOT_VERIFIED`, `PASSWORD_TOO_SHORT` (min 8), `USER_ALREADY_EXISTS`.

## Not built yet

- **Password reset.** Neon Auth resets through emailed links, which need a custom email provider (Resend, SES…) configured in Neon Auth; the SDK method isn't fully supported. Plan: configure provider → add `/forgot-password` and `/reset-password` pages.
- **Own Google OAuth client** (Google Cloud Console, Founders Club account) → `add_auth_oauth_provider` with `client_id`/`client_secret`; add the production domain with `add_auth_trusted_domain`; turn `allow_localhost` off on production.
- **Roles.** `users.role` (`student | organiser | judge | admin`) exists but nothing reads it yet. Admin/judge pages should check it in the page after `getViewer()`.
