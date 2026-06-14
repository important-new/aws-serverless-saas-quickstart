# Architecture

[**English**](ARCHITECTURE.md) ｜ [中文](zh-CN/ARCHITECTURE.md)

[← Back to README](../README.md)

---

This page indexes the architecture documentation. The high-level technical
stack, database design rules, project structure, and core-service summaries
live in the main [README](../README.md); the in-depth deep-dives are split into
the focused documents below.

## Contents

- **[Technical Architecture](../README.md#technical-architecture)** — backend/frontend
  stack, DynamoDB table-design principles, and the standard table structure
  (in the main README).
- **[Project Structure](../README.md#project-structure)** — the on-disk layout
  of `server/` (shared control-plane stack + tenant application-plane stack),
  `client/`, `e2e/`, `scripts/`, and `docs/` (in the main README).
- **[Platform Tenant Management Implementation](TENANT_MANAGEMENT.md)** — tenant
  lifecycle (registration, provisioning, deactivation), the Cognito ↔ DynamoDB
  association model, role-based access control, and service-tier management.
- **[API Configuration Relationships](API_CONFIGURATION.md)** — how API Gateway,
  Lambda, IAM, and resource policies wire together, walked through the
  `Create Tenant Admin User` (admin) and `GetOrdersFunction` (tenant) interfaces.
- **[Throttling and Monitoring](THROTTLING_AND_MONITORING.md)** — monitoring and
  operations, usage-plan-based API throttling per tier, and the CloudWatch Logs
  metric-filter throttling-monitoring mechanism.

## Two-stack model at a glance

| Stack | Path | Purpose | Example stack name |
| ----- | ---- | ------- | ------------------ |
| Shared (control plane) | `server/shared` | Cognito, admin API, tenant management, shared layers, usage plans | `saas-control-stack` |
| Tenant (application plane) | `server/services` | Product/Order services, tenant API, per-tenant throttling | `stack-pooled` |
| Silo provisioning | `server/TenantPipeline` | CDK pipeline that deploys dedicated stacks for Platinum tenants | — |

---

[← Back to README](../README.md)
