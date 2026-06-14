# Frontend Migration Runtime Verification Checklist (Angular 20 + Amplify v6)

[**English**](MIGRATION_VERIFICATION.md) ｜ [中文](zh-CN/MIGRATION_VERIFICATION.md)

[← Back to README](../README.md)

> Applies to branch: `chore/dependency-modernization`
> Purpose: the production build already passes, but **a passing build ≠ a passing
> runtime**. This checklist is for actually testing the authentication flows of
> the three apps in the browser (Amplify v6 sign-in / session / sign-out).

## 0. Prerequisites

- Node ≥ 20 (the migration in this repo was done on Node 22).
- Each app's `node_modules` is installed (`npm install` was run during the migration).
- **Valid backend configuration**: sign-in requires a real Cognito user pool and a deployed API.
  - `Admin`: reads `client/Admin/src/aws-exports.ts` (static Cognito config).
  - `Application`: dynamically fetches per-tenant config via `…/tenant/init/<tenant>`; the URL must include the tenant name.
  - `Landing`: registration form only, calls `environment.regApiGatewayUrl`.

## 1. Start up (pick either option)

```bash
# Convenience script: starts the three apps on 4200/4201/4202 respectively
bash scripts/serve-clients.sh

# Or start each one manually
cd client/Landing      && npx ng serve --port 4200
cd client/Application  && npx ng serve --port 4201
cd client/Admin        && npx ng serve --port 4202
```

## 2. Per-app verification checklist

### 2.1 Landing (no auth, verify first)
- [ ] Open `http://localhost:4200`; the page renders correctly (no blank screen).
- [ ] Browser Console has **no errors** (especially no Angular/zone.js startup errors).
- [ ] Fill out and submit the registration form → the Network panel shows a request to `regApiGatewayUrl`.
- [ ] Material controls (inputs/buttons/snackbar) are styled correctly (the theme color is now violet).

### 2.2 Admin (static Cognito sign-in)
- [ ] Open `http://localhost:4202`; the **Amplify Authenticator sign-in screen renders correctly**
      —— this verifies that Amplify v6 `Amplify.configure(aws_exports)` succeeds at runtime.
- [ ] Console has no `Amplify has not been configured` or module-resolution errors.
- [ ] Sign in with an admin account → successfully enter the backoffice (no longer bounced back to the sign-in page).
- [ ] Go to the "Tenants/Users" page → network request headers include `Authorization: Bearer <idToken>`
      —— verifies that `auth.interceptor.ts`'s `fetchAuthSession()` retrieves the token correctly.
- [ ] The username is shown at the top (verifies `nav.component` reads `idToken.payload`).
- [ ] Click sign out → return to the sign-in page (verifies `signOut({ global: true })`).

### 2.3 Application (dynamic per-tenant sign-in)
- [ ] Open via a tenant-aware entry point, e.g. `http://localhost:4201/<tenantName>` or the
      post-registration redirect path defined by the app (triggers `auth-configuration.service`'s `configureAmplifyAuth()`).
- [ ] The Authenticator sign-in screen renders correctly (verifies dynamic `Amplify.configure(awsmobile)`).
- [ ] A tenant user signs in successfully → enters the dashboard.
- [ ] `CognitoGuard` behavior: accessing a protected route while signed out → redirect to `/unauthorized`.
- [ ] The orders / products lists load (request headers include the Bearer token).
- [ ] Sign out works correctly.

## 3. Amplify v6 key things to watch (check these first when something breaks)

| Symptom | Possible cause | Location |
|---|---|---|
| Blank sign-in page / `Amplify has not been configured` | `Amplify.configure` not run before bootstrap, or the config format is not accepted | `main.ts` / `auth-configuration.service.ts` |
| Request missing the `Authorization` header | `tokens?.idToken` returned by `fetchAuthSession()` is empty | `auth.interceptor.ts` |
| Still considered unauthenticated after sign-in | `!!tokens?.idToken` check logic | `nav.component.ts` / `cognito.guard.ts` |
| Username/company name blank | `idToken.payload['custom:...']` field name | `nav.component.ts` |
| Sign-out has no effect | `signOut({ global: true })` | `*/auth.component.ts`, `nav.component.ts` |

## 4. Pass criteria

All three apps: can start up, render the sign-in page, can sign in, send the token
on protected requests, and can sign out, with no fatal Console errors → considered
to have passed runtime verification, and the branch may be merged.
