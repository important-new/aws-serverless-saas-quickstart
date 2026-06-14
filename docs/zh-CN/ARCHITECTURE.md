# 架构

[English](../ARCHITECTURE.md) ｜ [**中文**](ARCHITECTURE.md)

[← 返回 README](../../README.zh-CN.md)

---

本页是架构文档的索引。高层的技术栈、数据库设计规则、项目结构与核心服务说明
位于主 [README](../../README.zh-CN.md);深度剖析则拆分为下列专题文档。

## 目录

- **[技术架构](../../README.zh-CN.md#技术架构)** —— 后端/前端技术栈、DynamoDB
  表设计原则与标准表结构(在主 README 中)。
- **[项目结构](../../README.zh-CN.md#项目结构)** —— `server/`(共享控制面栈 +
  租户应用面栈)、`client/`、`e2e/`、`scripts/`、`docs/` 的磁盘布局(在主 README 中)。
- **[平台租户管理实现](TENANT_MANAGEMENT.md)** —— 租户生命周期(注册、供应、停用)、
  Cognito ↔ DynamoDB 关联模型、基于角色的访问控制与服务等级管理。
- **[接口配置关系](API_CONFIGURATION.md)** —— API Gateway、Lambda、IAM 与资源策略
  如何协同,以 `Create Tenant Admin User`(管理端)和 `GetOrdersFunction`(租户端)
  两个接口为例进行讲解。
- **[限流与监控](THROTTLING_AND_MONITORING.md)** —— 监控与运维、基于使用计划的分层
  API 限流,以及基于 CloudWatch Logs 指标过滤器的限流监控机制。

## 双栈模型一览

| 栈 | 路径 | 作用 | 示例栈名 |
| -- | ---- | ---- | -------- |
| 共享栈(控制面) | `server/shared` | Cognito、管理 API、租户管理、共享层、使用计划 | `saas-control-stack` |
| 租户栈(应用面) | `server/services` | 产品/订单服务、租户 API、按租户限流 | `stack-pooled` |
| 专用供应 | `server/TenantPipeline` | 为 Platinum 租户部署专用栈的 CDK 管道 | —— |

---

[← 返回 README](../../README.zh-CN.md)
