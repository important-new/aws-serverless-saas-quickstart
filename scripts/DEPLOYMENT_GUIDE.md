# 部署指南

本指南介绍 **AWS Serverless SaaS Quick Start** 的真实部署流程。整个部署由
`scripts/` 目录下的脚本驱动；本项目只有一套环境（单一 `[default]` 配置），
不存在 prod/dev/stage 多环境，也没有 `deploy-all.sh`。

## 先决条件

- **AWS CLI**：已安装并完成 `aws configure`，且默认区域设置为 `us-east-1`。
  （部署脚本通过 `aws configure get region` 读取该区域。）
- **AWS SAM CLI**：用于构建并部署后端两套栈。
- **Docker**：正在运行，供 `sam build --use-container` 使用。
- **Node.js**：20.19+ 或 22.12+（Angular 20 要求），用于构建三个前端应用及运行辅助脚本。
- **Python 3.13**：后端语言；部署前脚本会用 `pylint` 校验 `server/` 下的 Python 代码。
- **AWS CDK**：用于部署 Platinum（silo）租户的 `TenantPipeline`。

> 详见 [`../CONTRIBUTING.md`](../CONTRIBUTING.md) 与 [`../README.md`](../README.md)。

## 部署步骤

进入 `scripts/` 目录后依次执行两个脚本：

```bash
cd scripts
./deployment.sh
./geturl.sh
```

### `./deployment.sh`

一键完成整套部署，依次执行：

1. 用 `pylint` 校验 `server/` 下的 Python 代码，出错则中止。
2. 通过 `aws configure get region` 读取部署区域。
3. **部署共享（控制平面）栈**：在 `server/shared` 下 `sam build` 后执行
   `sam deploy --config-file samconfig.toml`，栈名为 `saas-control-stack`
   （S3 前缀 `saas-control`，单一 `[default]` 配置，不使用 `--config-env`）。
4. **部署租户（应用平面）pooled 栈**：在 `server/services` 下 `sam build` 后
   执行 `sam deploy --config-file samconfig.toml`，栈名为 `stack-pooled`。
5. **部署 TenantPipeline**：在 `server/TenantPipeline` 下 `npm install`、
   `cdk bootstrap`、`cdk deploy`，用于 Platinum 层 silo 租户的自动化置备。
6. 从 `saas-control-stack` 的输出读取三个前端站点的 S3 桶名与访问 URL。
7. **构建并发布三个前端**：分别在 `client/Admin`、`client/Application`、
   `client/Landing` 下执行 `npm install && npm run build`，再
   `aws s3 sync dist/ s3://<对应桶>/ --delete`。

### `./geturl.sh`

打印已部署站点的访问地址（Admin / Landing / App）。它会自动适配运行环境：

- 在 Workshop Studio 中，从 CloudFormation Exports 读取 `Serverless-SaaS-*`。
- 否则，从栈 `saas-control-stack` 的输出
  （`AdminAppSite` / `LandingApplicationSite` / `ApplicationSite`）读取。

## 辅助脚本

`scripts/` 目录下还提供以下辅助脚本：

- **`serve-clients.sh`**：在本地分别用 4200/4201/4202 端口同时启动 Landing、
  Application、Admin 三个 Angular 应用，便于本地验证（Ctrl-C 全部停止）。
- **`get-login-info.js`**：从 `saas-control-stack` 输出汇总登录信息
  （Admin 站点 URL、AdminApi、Cognito 用户池/客户端 ID）及默认凭据。
- **`create-admin-user.js`**：交互式在运营用户池中创建一个新的管理员用户
  （用户名/邮箱/密码），并设置为永久密码。
- **`set-admin-password.js`**：交互式为默认 `admin` 用户设置新的永久密码。
- **`manage-users.js`**：交互式用户管理菜单（列出/创建/改密/删除用户、查看登录信息）。
- **`local-test-product.sh`**：完全本地、零 AWS 账号的 product-service 测试，
  使用 Docker 版 DynamoDB Local 配合 `sam local invoke` 跑一遍 CRUD。
- **`test-basic-tier-throttling.sh`**：向 `stack-pooled` 的 `TenantAPI` 并发发起
  大量 `/products` 请求，用于验证 Basic 层的 API 限流。
- **`generate-env-config.js`**：从 `saas-control-stack` 的 `AdminApi` 输出生成
  指定前端应用的 `environment.ts`。
