# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> This project is a community-maintained derivative (MIT-0) of the
> [AWS Serverless SaaS Workshop](https://github.com/aws-samples/aws-serverless-saas-workshop),
> based on its **Lab6**. For the full, file-level account of how it diverges from
> upstream, see [`docs/CHANGES_FROM_WORKSHOP.md`](docs/CHANGES_FROM_WORKSHOP.md).

## [Unreleased]

## [2.0.0] - 2026-06-14

Dependency & runtime modernization, a cross-platform test suite, and a security
pass. The frontend framework and several backend dependencies received breaking
major upgrades, hence the major version bump.

### Added
- Cross-platform backend test suite using **pytest + moto** (in-memory DynamoDB,
  no Docker/AWS required): `requirements-test.txt`, `pytest.ini`, `server/conftest.py`,
  and per-service `tests/test_*.py`.
- Cross-platform frontend smoke tests using **Playwright** (`e2e/`).
- **GitHub Actions CI**: `.github/workflows/backend-tests.yml` (pytest on
  ubuntu/windows/macOS) and `.github/workflows/frontend-e2e.yml`, both with
  `workflow_dispatch`.
- A free local high-fidelity backend test path (DynamoDB Local + `sam local invoke`)
  documented in [`docs/LOCAL_TESTING.md`](docs/LOCAL_TESTING.md).
- Open-source project documentation: bilingual `README.md` / `README.zh-CN.md`,
  `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, this changelog, and
  GitHub issue/PR templates.
- `docs/DEPENDENCY_AUDIT.md` and `docs/MIGRATION_VERIFICATION.md`.

### Changed
- Upgraded the frontend to **Angular 20** (standalone components, Material **M3**
  `mat.theme()` theming), **TypeScript 5.8**, **AWS Amplify v6** +
  **@aws-amplify/ui-angular 5**, across all three apps (Admin / Application / Landing).
  **Node.js 20.19+ or 22.12+** is now required.
- Migrated the Amplify auth calls to the v6 API (`fetchAuthSession`,
  `token.toString()`, named `Amplify` import, etc.).
- Pinned all Python `requirements.txt` dependencies to major-version-compatible
  ranges for reproducibility; bumped `@types/node` to `^20` and `aws-cdk-lib` to `^2.258`.

### Removed
- The deprecated `@angular/flex-layout` (no longer published for Angular 20);
  the single layout usage was replaced with inline CSS.

### Fixed
- Three pre-existing `update_*` bugs in the product/order service DALs, found via
  local DynamoDB testing: naive `datetime` usage, `ReturnValues="UPDATED_NEW"`
  vs `ALL_NEW`, and `vars()` called on a `dict`-shaped `order_products` entry.
- Angular `serve`/`build` `browserTarget` renamed to `buildTarget` for the
  Angular 17+ schema.

### Security
- Replaced the unmaintained **python-jose** with **PyJWT[crypto]** and rewrote
  both Cognito JWT authorizers, avoiding **CVE-2024-33663** and **CVE-2024-33664**.
- Scrubbed a hardcoded admin email and password from the sources, replaced real
  deployment identifiers (Cognito pool/client IDs, API URLs, CloudFront IDs) with
  placeholders, and rewrote git history to remove them.

## [1.0.1] - 2025-08-05

Initial tagged baseline of the derivative: Lab6 reworked from a teaching-oriented
lab into a deployable, structurally simplified reference implementation. See
[`docs/CHANGES_FROM_WORKSHOP.md`](docs/CHANGES_FROM_WORKSHOP.md) for the complete
divergence record and the upstream→quickstart path mapping.

### Changed
- Restructured the backend from the upstream flat layout (`ProductService/`,
  `OrderService/`, `TenantManagementService/`) into per-service micro-stacks under
  `server/services/{product-service, order-service, tenant-api}/`, each with its own
  `template.yaml` + `samconfig.toml`, and introduced a DAL layer
  (`*_service.py` + `*_service_dal.py` + `*_models.py`).
- Collected shared infrastructure (auth, layers, nested templates, custom
  resources, tenant management) under `server/shared/`.
- Simplified the DynamoDB data model: switched Order/Product services to use
  **`tenant_id` as the partition key** instead of the previous `shardId` sharding
  + parallel-query strategy.
- Upgraded the Lambda runtime and CDK pipeline to **Python 3.13**; CodeBuild image
  moved to `STANDARD_7_0`. Fixed/refreshed AWS Lambda Powertools dependencies.
- Renamed the tenant stack `pooled-tenant-stack` → `stack-pooled`; changed the
  default `LambdaReserveConcurrency` from `20` to `0`.

### Added
- Node.js operations tooling (`create-admin-user.js`, `manage-users.js`,
  `set-admin-password.js`, `get-login-info.js`, `generate-env-config.js`),
  `deploy`/`reset` scripts (S3 sync + CloudFront invalidation) in the frontend
  `package.json` files, and `scripts/DEPLOYMENT_GUIDE.md`.
- Root licensing/attribution files: `LICENSE` (MIT-0), `NOTICE`,
  `THIRD-PARTY-LICENSES.txt`.

### Removed
- The upstream flat `server/` service layout and the monolithic
  `shared-template.yaml` / `tenant-template.yaml`, plus the `shardId`-based
  sharding strategy and its parallel-query logic.

[Unreleased]: https://github.com/important-new/aws-serverless-saas-quickstart/compare/2.0.0...HEAD
[2.0.0]: https://github.com/important-new/aws-serverless-saas-quickstart/compare/1.0.1...2.0.0
[1.0.1]: https://github.com/important-new/aws-serverless-saas-quickstart/releases/tag/1.0.1
