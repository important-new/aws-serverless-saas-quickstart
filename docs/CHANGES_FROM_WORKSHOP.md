# Changes from the Upstream AWS Serverless SaaS Workshop

[**English**](CHANGES_FROM_WORKSHOP.md) ｜ [中文](zh-CN/CHANGES_FROM_WORKSHOP.md)

[← Back to README](../README.md)

This document records the changes that **aws-serverless-saas-quickstart** makes
relative to the upstream **AWS Serverless SaaS Workshop**
(`aws-samples/aws-serverless-saas-workshop`, corresponding to its `Lab6`), and
the reasons behind them.

## 1. Lineage and Positioning

- This project is derived from **Lab6** of the upstream Workshop (its final lab
  version). For copyright and license provenance, see the [`NOTICE`](../NOTICE)
  and [`LICENSE`](../LICENSE) (MIT-0) files in the repository root.
- The upstream Workshop is a **teaching lab sequence** (Lab1–Lab7, building up
  step by step), positioned as training material; this project instead
  refactors Lab6 into a **directly deployable, streamlined reference
  implementation / quick-start template**.
- **This project has evolved as an independent derivative and no longer
  contributes changes back upstream**; the reasons are given in Section 4.

## 2. Overview of Differences

Comparing quickstart against workshop/Lab6 (excluding `node_modules`, build
artifacts, etc.):

| Category | File count | Notes |
|---|---:|---|
| Identical | 184 | Mostly the Angular frontend scaffolding, landing page, and unmodified templates |
| Same path but modified | 24 | Dependency upgrades, configuration, some frontend services/models |
| quickstart only (added) | 69 | The refactored new structure, new operational scripts, license files, etc. |
| Lab6 only (replaced/removed) | 38 | The old flat server structure |

By file count roughly 66% is identical, but the identical portion is
concentrated in frontend boilerplate; **the backend (the core of the project)
is almost entirely rewritten**.

## 3. Major Changes and Reasons

### 3.1 Backend Architecture: Monolithic Templates → Per-Service Split
- **Change**: The flat service directories under the upstream `server`
  (`ProductService/`, `OrderService/`, `TenantManagementService/`) and the two
  large templates (`shared-template.yaml`, `tenant-template.yaml`) were
  reorganized into:
  - `server/services/{product-service, order-service, tenant-api}/` — each
    service has its **own** `template.yaml` + `samconfig.toml` (split into
    independently deployable micro-stacks);
  - The Python code introduces a DAL layering: `*_service.py` +
    `*_service_dal.py` + `*_models.py`.
- **Reason**: Reduce coupling between services, support independent service
  deployment, and improve template maintainability.
- **Related commits**: `bcb1d1a` (restructure serverless SaaS architecture with
  service separation), `0805565`, `753aa67`, `666dd8b`.

### 3.2 Shared Resources Consolidated into `server/shared/`
- **Change**: `layers/`, `nested_templates/`, `custom_resources/`, `Auth/`,
  `tenant-management/`, etc., which were scattered across the server root, were
  consolidated into
  `server/shared/{auth, layers, nested_templates, custom_resources, tenant-management}/`.
- **Reason**: Clearly distinguish "shared infrastructure" from "business
  services", giving directories clearer responsibilities.
- **Related commits**: `0805565` (move tenant-management from infrastructure to
  shared), `753aa67` (restructure shared infrastructure directory layout),
  `b632860` (reorganize auth components).

### 3.3 Data Model: Remove `shardId` Sharding, Switch to `tenant_id` Partition Key
- **Change**: The DynamoDB design for the Order / Product services was changed
  from "`shardId` sharding + parallel queries" to a simplified design that uses
  `tenant_id` as the partition key; the data models, CRUD, and frontend
  templates were updated accordingly.
- **Reason**: Eliminate the complex sharding/parallel-query logic, make the data
  distribution more predictable, and reduce storage and query costs (see the
  "Database Design Rules" section of the README for details).
- **Related commits**: `37a2587` (use tenant_id instead of shardId), `40ea9ff`.

### 3.4 Python Runtime Upgraded to 3.13
- **Change**: The Lambda runtime and the CDK pipeline were unified and upgraded
  from older versions to **Python 3.13**, and the CodeBuild build image was
  changed to `STANDARD_7_0`.
- **Reason**: The older runtime used upstream was near/at EOL; the upgrade
  obtains long-term support and security updates.
- **Related commits**: `7ea8533`.

### 3.5 Dependency Fixes and Upgrades (incl. AWS Lambda Powertools)
- **Change**: Fixed and upgraded outdated dependencies, with a focus on
  correcting Powertools-related dependencies.
- **Reason**: The upstream dependency versions were outdated and had
  compatibility/security issues.
- **Related commits**: `b632860` (fix powertools dependencies).

### 3.6 Frontend: Angular and Amplify Adjustments
- **Change**: An initial attempt at Angular 16.2.12 + AWS Amplify v6
  (`51c412b`) was later **rolled back to Angular 14.x** due to compatibility
  issues, with the authentication logic changed to the updated Amplify call
  style (`184f5f9`).
- **Reason**: Version compatibility and stability.
- **Related commits**: `51c412b`, `184f5f9`, `40ea9ff`.

### 3.7 Deployment and Operations Script Enhancements
- **Change**:
  - Each frontend `package.json` gained `deploy` / `reset` scripts (S3 sync +
    CloudFront invalidation);
  - A batch of new Node.js operational tooling scripts was added:
    `create-admin-user.js`, `manage-users.js`, `set-admin-password.js`,
    `get-login-info.js`, `generate-env-config.js`;
  - Added the `scripts/DEPLOYMENT_GUIDE.md` deployment guide.
- **Reason**: Simplify the deployment process and the day-to-day management of
  tenant/admin users.
- **Related commits**: `5366935` and the new files listed above.

### 3.8 Other Configuration Adjustments
- Tenant stack naming `pooled-tenant-stack` → `stack-pooled` (`8634f86`).
- `LambdaReserveConcurrency` default value `20` → `0` (`2a262ad`), to avoid
  deployment failures in environments where the account's reserved-concurrency
  quota is constrained.

## 4. Why We No Longer Contribute Back Upstream

1. **Structural refactoring is hard to contribute back**: directory renames,
   template splits, and data-model changes make the vast majority of changes
   impossible to cleanly cherry-pick back upstream — the paths and structure no
   longer line up, and a PR would turn into a large-scale "delete one chunk, add
   another chunk", making review and merge costs extremely high.
2. **Different positioning**: the upstream is a step-by-step teaching lab
   sequence (Lab1–Lab7) that deliberately preserves a layer-by-layer evolving
   structure; this project is a streamlined product aimed at deployment, and the
   two have inconsistent goals.
3. **Independent maintenance**: this project is therefore maintained as an
   **independent derivative**, open-sourced under MIT-0; the upstream attribution
   and provenance are preserved in `NOTICE`.

> Note: only a small number of "narrow same-path changes" (such as deployment
> script fixes and a few dependency upgrades) are technically still
> contributable, but the overall benefit is limited, so this is not a current
> goal.

## 5. Structure Mapping (Old → New)

| Upstream Lab6 path | quickstart path |
|---|---|
| `server/ProductService/` | `server/services/product-service/src/` |
| `server/OrderService/` | `server/services/order-service/src/` |
| `server/TenantManagementService/` | `server/shared/tenant-management/`, `server/services/tenant-api/` |
| `server/Auth/` | `server/shared/auth/` |
| `server/layers/` | `server/shared/layers/` |
| `server/nested_templates/` | `server/shared/nested_templates/` |
| `server/custom_resources/` | `server/shared/custom_resources/` |
| `server/shared-template.yaml` + `server/tenant-template.yaml` | split into per-service `services/*/template.yaml` + `server/shared/**` + `server/services/template.yaml` |

> The table above shows directory-level correspondences; files may have been
> renamed and code refactored during migration, so it is for provenance
> reference only.
