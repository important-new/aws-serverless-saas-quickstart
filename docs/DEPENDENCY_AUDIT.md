# Dependency & Runtime Support Status Audit

[**English**](DEPENDENCY_AUDIT.md) ｜ [中文](zh-CN/DEPENDENCY_AUDIT.md)

[← Back to README](../README.md)

> Audit date: 2026-06-14　｜　Assessed against "current community maintenance / official AWS support" status

## Overall Conclusion

- **Backend / infrastructure**: Runtime choices are healthy and currently supported.
- **Frontend**: The Angular / Amplify stack is **EOL (end of life)** overall, frozen at 2022 versions.
- **Highest-priority security item**: `python-jose` is unmaintained and has active CVEs; it must be replaced.

---

## 1. Backend / Infrastructure (✅ Largely Healthy)

| Component | Version in code | Status | Notes |
|---|---|---|---|
| Lambda runtime | `python3.13` | ✅ Currently supported | AWS support through ~2029-10; the latest is already 3.14 (2025-11), 3.13 is a safe LTS choice |
| CodeBuild image | `STANDARD_7_0` + `python:3.13` | ✅ Available | Python 3.13 has been bundled in standard:7.0 since 2025-03 |
| `aws-cdk-lib` | `^2.0.0` | ✅ Supported | CDK v2 is maintained (v1 reached EOL 2023-06). Floor is low; recommend verifying the lockfile resolves to the latest 2.x |
| `constructs` | `^10.0.0` | ✅ | Matches CDK v2 |
| `aws-lambda-powertools` `jsonpickle` `simplejson` `requests` `pytest-mock` | Unpinned | ✅ Maintained | — |

## 2. Backend Items to Watch (⚠️ / ❌)

| Item | Status | Affected locations | Disposition |
|---|---|---|---|
| **`python-jose[cryptography]`** | ❌ Unmaintained + CVE | `services/tenant-api`, `shared/auth`, `shared/layers` | **Migrate to `PyJWT`**. Involves JWT verification (security-sensitive path). Related CVEs: CVE-2024-33663 (algorithm confusion), CVE-2024-33664 (JWE DoS) |
| **Unpinned Python dependencies** | ⚠️ Reproducibility / supply-chain risk | All `requirements.txt` | Pin major versions or introduce a lock (pip-tools) |
| `crhelper` / `aws_requests_auth` | ⚠️ Low activity | `shared/custom_resources`, multiple places | Still usable, keep an eye on it |
| `@types/node` | ⚠️ `10.17.27` (Node 10 reached EOL 2021) | `TenantPipeline` | Upgrade to a `@types/node` matching the build Node (types only, no runtime impact) |

## 3. Frontend (❌ EOL Overall)

| Component | Version in code | Status | Current / target |
|---|---|---|---|
| `@angular/core` / `@angular/cli` | `~14.0.0` / `~14.0.5` | ❌ EOL (~end of 2023) | Maintained: 20 (through 2026-11) / 21 (through 2027-05) / 22 |
| `aws-amplify` | `~4.3.27` | ❌ EOL | Only v5/v6 are supported |
| `@aws-amplify/ui-angular` | `~2.4.14` | ❌ Ancient | Latest 5.3.5, requires Angular ≥ 19 |
| `typescript` | `~4.7.2` | ⚠️ Old (pinned by Angular 14) | 5.x |
| `rxjs` / `zone.js` | `7.5` / `0.11.4` | ⚠️ Old (bound to Angular 14) | — |

> The frontend is an interlocked stack: Angular 14 ↔ Amplify v4 ↔ ui-angular 2.x ↔ TS 4.7.
> Modernization requires a coordinated jump across the board: Angular `14→20/21`, aws-amplify `v4→v6`, ui-angular `2.x→5.x`
> (ui-angular 5.x requires Angular 19+). Among these, the **Amplify v4→v6 Auth API is a breaking rewrite** with the largest workload, and should be treated as a standalone migration project with build/E2E verification.

---

## 4. Disposition Priority

| Level | Item | Risk / effort |
|---|---|---|
| 🔴 P0 (security) | `python-jose` → `PyJWT` | Medium; requires changing JWT verification code and testing |
| 🟠 P1 (reproducibility) | Pin Python dependency versions | Low |
| 🟢 P2 (misc) | `@types/node` upgrade, CDK lockfile verification | Low |
| 🟡 P3 (large effort) | Frontend overall upgrade to Angular 20/21 + Amplify v6 + ui-angular 5.x | High, breaking, requires a dedicated project |

## 4.1 Disposition Progress (2026-06-14, branch `chore/dependency-modernization`)

| Level | Status | Notes |
|---|---|---|
| 🔴 P0 | ✅ Done | `python-jose` → `PyJWT[crypto]`, rewrote signature verification in two authorizers; 6 unit test cases passing |
| 🟠 P1 | ✅ Done | Pinned all `requirements.txt` versions (compatible-range pinning at the major version) |
| 🟢 P2 | ✅ Done | `@types/node`→`^20`, `aws-cdk-lib`→`^2.258` and refreshed lockfile; fixed `\*` escaping |
| 🟡 P3 | ✅ Done (build layer) | **All three frontend apps Angular 14 → 20**; Admin/Application also **Amplify v4 → v6**, ui-angular 2→5; removed the deprecated `@angular/flex-layout`; production builds all pass |

### Frontend Migration Notes
- Unified all `@angular/*` to `^20`, TypeScript `5.8`, zone.js `0.15`, rxjs `7.8`.
- Material: removed deleted `legacy-*` imports; switched theming to M3 `mat.theme()` (indigo→violet, pink→rose, visually similar).
- Since Angular 19, components are standalone by default: added `standalone: false` to components declared in NgModules.
- Amplify v6: `Auth.currentSession()`→`fetchAuthSession()`, `getJwtToken()`→`token.toString()`, `isValid()`→`!!tokens?.idToken`, `Auth.signOut()`→`signOut()`; the legacy `Amplify.configure(aws_exports)` format is still compatible in v6.
- SCSS: removed the webpack `~` prefix; ui-angular 5's `theme.css` is imported via the `styles` array in angular.json (its exports field does not expose that subpath).

### ⚠️ Not Yet Verified (requires runtime confirmation)
- A passing production build ≠ passing at runtime. **The Amplify v6 sign-in/session/sign-out flow needs real-browser testing** (`npm start` + a real Cognito login).
- The backend PyJWT change was verified by standalone unit tests, **not integration-tested in a deployed Lambda**.
- The Material theme color changed from indigo to violet (a custom M3 palette is needed for exact brand colors).

## 5. Sources

- AWS Lambda runtimes: <https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html>
- Lambda adds Python 3.13: <https://aws.amazon.com/about-aws/whats-new/2024/11/aws-lambda-support-python-313/>
- CodeBuild adds Python 3.13 (standard:7.0): <https://aws.amazon.com/about-aws/whats-new/2025/03/aws-codebuild-node-22-python-3-13-go-1-23>
- python-jose CVE-2024-33663: <https://www.vicarius.io/vsociety/posts/algorithm-confusion-in-python-jose-cve-2024-33663>
- PyJWT migration guidance: <https://github.com/jpadilla/pyjwt/issues/942>
- Angular versions and EOL: <https://www.herodevs.com/blog-posts/angular-version-history-every-release-date-support-window-and-end-of-life-date-from-angularjs-to-angular-22>
- @aws-amplify/ui-angular (npm registry): <https://registry.npmjs.org/@aws-amplify/ui-angular/latest>
