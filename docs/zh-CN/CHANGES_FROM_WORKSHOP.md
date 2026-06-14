# 与上游 AWS Serverless SaaS Workshop 的差异说明

[English](../CHANGES_FROM_WORKSHOP.md) ｜ [**中文**](CHANGES_FROM_WORKSHOP.md)

[← 返回 README](../../README.zh-CN.md)

本文件记录 **aws-serverless-saas-quickstart** 相对上游 **AWS Serverless SaaS
Workshop**（`aws-samples/aws-serverless-saas-workshop`，对应其 `Lab6`）所做的
修改及原因。

## 1. 血缘与定位

- 本项目派生自上游 Workshop 的 **Lab6**（最终实验版本）。版权与许可证溯源见
  仓库根目录的 [`NOTICE`](../NOTICE) 与 [`LICENSE`](../LICENSE)（MIT-0）。
- 上游 Workshop 是一套**教学实验序列**（Lab1~Lab7，逐步引导搭建），定位是培训
  材料；本项目则把 Lab6 重构为一个**可直接落地、结构精简的参考实现/快速启动模板**。
- **本项目已作为独立衍生项目演进，不再向上游回馈改动**，原因见第 4 节。

## 2. 差异概览

以 quickstart 对比 workshop/Lab6（已排除 `node_modules`、构建产物等）：

| 类别 | 文件数 | 说明 |
|---|---:|---|
| 完全相同 | 184 | 多为前端 Angular 脚手架、Landing 页、未改动的模板 |
| 同路径但已修改 | 24 | 依赖升级、配置、部分前端 service/model |
| 仅 quickstart（新增） | 69 | 重构后的新结构、新增运维脚本、许可证文件等 |
| 仅 Lab6（被替换/删除） | 38 | 旧的扁平 server 结构 |

按文件数约 66% 相同，但相同部分集中在前端样板；**后端（项目核心）几乎被重写**。

## 3. 主要变更与原因

### 3.1 后端架构：单体模板 → 按服务拆分
- **变更**：上游 server 下的扁平服务目录（`ProductService/`、`OrderService/`、
  `TenantManagementService/`）与两个大模板（`shared-template.yaml`、
  `tenant-template.yaml`）被重组为：
  - `server/services/{product-service, order-service, tenant-api}/`——每个服务
    拥有**独立**的 `template.yaml` + `samconfig.toml`（拆成可独立部署的微栈）；
  - Python 代码引入 DAL 分层：`*_service.py` + `*_service_dal.py` + `*_models.py`。
- **原因**：降低服务间耦合、支持服务独立部署、提升模板可维护性。
- **相关提交**：`bcb1d1a` (restructure serverless SaaS architecture with service
  separation)、`0805565`、`753aa67`、`666dd8b`。

### 3.2 共享资源归集到 `server/shared/`
- **变更**：`layers/`、`nested_templates/`、`custom_resources/`、`Auth/`、
  `tenant-management/` 等由散落在 server 根目录，统一收纳到
  `server/shared/{auth, layers, nested_templates, custom_resources, tenant-management}/`。
- **原因**：明确区分「共享基础设施」与「业务服务」，目录职责更清晰。
- **相关提交**：`0805565` (move tenant-management from infrastructure to shared)、
  `753aa67` (restructure shared infrastructure directory layout)、
  `b632860` (reorganize auth components)。

### 3.3 数据模型：移除 `shardId` 分片，改用 `tenant_id` 分区键
- **变更**：Order / Product 服务的 DynamoDB 设计由「`shardId` 分片 + 并行查询」
  改为以 `tenant_id` 作为分区键的简化设计；同步更新数据模型、CRUD 与前端模板。
- **原因**：消除复杂的分片/并行查询逻辑，数据分布更可预测，降低存储与查询成本
  （详见 README「数据库设计规则」一节）。
- **相关提交**：`37a2587` (use tenant_id instead of shardId)、`40ea9ff`。

### 3.4 Python 运行时升级到 3.13
- **变更**：Lambda 运行时与 CDK 流水线由旧版本统一升级到 **Python 3.13**，
  CodeBuild 构建镜像改为 `STANDARD_7_0`。
- **原因**：上游使用的旧运行时已接近/到达 EOL，升级以获得长期支持与安全更新。
- **相关提交**：`7ea8533`。

### 3.5 依赖修复与升级（含 AWS Lambda Powertools）
- **变更**：修复并升级过时依赖，重点修正 Powertools 相关依赖。
- **原因**：上游依赖版本过时，存在兼容性/安全问题。
- **相关提交**：`b632860` (fix powertools dependencies)。

### 3.6 前端：Angular 与 Amplify 调整
- **变更**：初期尝试 Angular 16.2.12 + AWS Amplify v6（`51c412b`），后因兼容性
  **回滚到 Angular 14.x**，并将认证逻辑改为更新后的 Amplify 调用方式（`184f5f9`）。
- **原因**：版本兼容性与稳定性。
- **相关提交**：`51c412b`、`184f5f9`、`40ea9ff`。

### 3.7 部署与运维脚本增强
- **变更**：
  - 各前端 `package.json` 增加 `deploy` / `reset` 脚本（S3 sync + CloudFront 失效）；
  - 新增一批 Node.js 运维工具脚本：`create-admin-user.js`、`manage-users.js`、
    `set-admin-password.js`、`get-login-info.js`、`generate-env-config.js`；
  - 新增 `scripts/DEPLOYMENT_GUIDE.md` 部署指南。
- **原因**：简化部署流程与租户/管理员用户的日常管理。
- **相关提交**：`5366935` 及上述新增文件。

### 3.8 其他配置调整
- 租户栈命名 `pooled-tenant-stack` → `stack-pooled`（`8634f86`）。
- `LambdaReserveConcurrency` 默认值 `20` → `0`（`2a262ad`），避免在账号预留并发
  配额受限的环境下部署失败。

## 4. 为什么不再向上游回馈

1. **结构性重构难以回馈**：目录改名、模板拆分、数据模型变更使绝大多数改动无法
   干净地 cherry-pick 回上游——路径与结构都对不上，PR 会变成大规模的「删一片、
   加一片」，评审与合并成本极高。
2. **定位不同**：上游是分步教学的实验序列（Lab1~Lab7），刻意保留逐层演进的结构；
   本项目是面向落地的精简产品，二者目标不一致。
3. **维护独立**：因此本项目作为**独立衍生项目**维护，按 MIT-0 开源；上游署名与
   来源在 `NOTICE` 中保留。

> 注：仅有少量「同路径的窄改动」（如部署脚本修复、个别依赖升级）在技术上仍可回馈，
> 但综合收益有限，当前不作为目标。

## 5. 结构对照（旧 → 新）

| 上游 Lab6 路径 | quickstart 路径 |
|---|---|
| `server/ProductService/` | `server/services/product-service/src/` |
| `server/OrderService/` | `server/services/order-service/src/` |
| `server/TenantManagementService/` | `server/shared/tenant-management/`、`server/services/tenant-api/` |
| `server/Auth/` | `server/shared/auth/` |
| `server/layers/` | `server/shared/layers/` |
| `server/nested_templates/` | `server/shared/nested_templates/` |
| `server/custom_resources/` | `server/shared/custom_resources/` |
| `server/shared-template.yaml` + `server/tenant-template.yaml` | 拆分为各服务 `services/*/template.yaml` + `server/shared/**` + `server/services/template.yaml` |

> 上表为目录级对应关系，文件在迁移过程中可能伴随重命名与代码重构，仅供溯源参考。
