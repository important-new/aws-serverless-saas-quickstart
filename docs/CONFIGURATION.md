# 配置指南（前端环境与 Cognito）

本仓库**不包含任何真实部署的标识符**。以下文件中的值均为**占位符**，
需替换为你自己部署的值后再构建/运行。

> 说明：Cognito User Pool ID、App Client ID、API Gateway URL、CloudFront
> Distribution ID 都会被打包进浏览器或脚本，**并非机密**；占位化的目的是
> 不让本公开仓库绑定到任何特定的 AWS 部署。

## 需要填写的占位符

| 占位符 | 含义 | 出现位置 |
|---|---|---|
| `us-east-1_XXXXXXXXX` | Cognito User Pool ID | `client/Admin/src/aws-exports.ts`、`client/Admin/script/auth-config.js` |
| `XXXXXXXXXXXXXXXXXXXXXXXXXX` | Cognito App Client ID | 同上 |
| `YOUR_API_ID` | 共享 API Gateway 的 REST API ID | 各 app `src/environments/environment*.ts` |
| `YOUR_CLOUDFRONT_DISTRIBUTION_ID` | 各站点的 CloudFront 分发 ID | 各 app `package.json` 的 `reset` 脚本 |

## 方式一：脚本生成（推荐，针对 environment.ts）

仓库已提供 `scripts/generate-env-config.js`，会用 AWS CLI 查询共享 API 并
生成对应 app 的 `environment.ts`：

```bash
# 需先配置好 AWS CLI 凭证与区域
node scripts/generate-env-config.js Admin prod
node scripts/generate-env-config.js Application prod
node scripts/generate-env-config.js Landing prod
```

## 方式二：手动填写

1. **Cognito**（`client/Admin/src/aws-exports.ts`）：把 `us-east-1_XXXXXXXXX`、
   `XXXXXXXXXXXXXXXXXXXXXXXXXX` 替换为你的 User Pool ID 与 App Client ID。
2. **API URL**（`client/*/src/environments/environment*.ts`）：把 `YOUR_API_ID`
   替换为共享 API Gateway 的 REST API ID。
3. **CloudFront**（`client/*/package.json` 的 `reset` 脚本）：把
   `YOUR_CLOUDFRONT_DISTRIBUTION_ID` 替换为各站点分发 ID。

## ⚠️ 避免再次提交真实值

填入真实值后，**不要把它们提交回仓库**。建议本地用下列方式之一隔离：

```bash
# 让 git 忽略对这些文件的本地改动（不影响他人）
git update-index --skip-worktree \
  client/Admin/src/aws-exports.ts \
  client/Admin/src/environments/environment.ts \
  client/Admin/src/environments/environment.prod.ts \
  client/Application/src/environments/environment.ts \
  client/Application/src/environments/environment.prod.ts \
  client/Landing/src/environments/environment.ts \
  client/Landing/src/environments/environment.prod.ts
```

（撤销：`git update-index --no-skip-worktree <file>`）
