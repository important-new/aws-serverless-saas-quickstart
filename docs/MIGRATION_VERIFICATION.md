# 前端迁移运行时验证清单（Angular 20 + Amplify v6）

> 适用分支：`chore/dependency-modernization`
> 目的：生产构建已通过，但**构建通过 ≠ 运行时通过**。本清单用于在浏览器中
> 实测三个应用的认证流程（Amplify v6 的登录/会话/登出）。

## 0. 前置条件

- Node ≥ 20（本仓库迁移在 Node 22 上完成）。
- 各应用 `node_modules` 已安装（迁移过程中已 `npm install`）。
- **有效的后端配置**：登录需要真实的 Cognito 用户池与已部署的 API。
  - `Admin`：读取 `client/Admin/src/aws-exports.ts`（静态 Cognito 配置）。
  - `Application`：通过 `…/tenant/init/<tenant>` 动态获取每租户配置，URL 需带租户名。
  - `Landing`：仅注册表单，调用 `environment.regApiGatewayUrl`。

## 1. 启动（任选其一）

```bash
# 便捷脚本：三个应用分别在 4200/4201/4202 启动
bash scripts/serve-clients.sh

# 或手动单独启动
cd client/Landing      && npx ng serve --port 4200
cd client/Application  && npx ng serve --port 4201
cd client/Admin        && npx ng serve --port 4202
```

## 2. 逐应用验证清单

### 2.1 Landing（无认证，最先验证）
- [ ] 打开 `http://localhost:4200`，页面正常渲染（无白屏）。
- [ ] 浏览器 Console **无报错**（尤其无 Angular/zone.js 启动错误）。
- [ ] 填写注册表单并提交 → 网络面板可见对 `regApiGatewayUrl` 的请求。
- [ ] Material 控件（输入框/按钮/snackbar）样式正常（主题色现为 violet）。

### 2.2 Admin（静态 Cognito 登录）
- [ ] 打开 `http://localhost:4202`，**Amplify Authenticator 登录界面正常渲染**
      —— 这验证了 Amplify v6 `Amplify.configure(aws_exports)` 运行时成功。
- [ ] Console 无 `Amplify has not been configured` 或模块解析类报错。
- [ ] 用管理员账号登录 → 成功进入后台（不再回到登录页）。
- [ ] 进入“租户/用户”页 → 网络请求头含 `Authorization: Bearer <idToken>`
      —— 验证 `auth.interceptor.ts` 的 `fetchAuthSession()` 取 token 正常。
- [ ] 顶部显示用户名（验证 `nav.component` 读取 `idToken.payload`）。
- [ ] 点击登出 → 回到登录页（验证 `signOut({ global: true })`）。

### 2.3 Application（动态每租户登录）
- [ ] 以带租户的入口打开，例如 `http://localhost:4201/<tenantName>` 或应用约定的
      注册后跳转路径（触发 `auth-configuration.service` 的 `configureAmplifyAuth()`）。
- [ ] Authenticator 登录界面正常渲染（验证动态 `Amplify.configure(awsmobile)`）。
- [ ] 租户用户登录成功 → 进入 dashboard。
- [ ] `CognitoGuard` 行为：未登录访问受保护路由 → 跳 `/unauthorized`。
- [ ] orders / products 列表能加载（请求头含 Bearer token）。
- [ ] 登出正常。

## 3. Amplify v6 重点观察项（出问题时优先看这些）

| 现象 | 可能原因 | 位置 |
|---|---|---|
| 登录页空白 / `Amplify has not been configured` | `Amplify.configure` 未在 bootstrap 前执行或配置格式不被接受 | `main.ts` / `auth-configuration.service.ts` |
| 请求缺少 `Authorization` 头 | `fetchAuthSession()` 返回的 `tokens?.idToken` 为空 | `auth.interceptor.ts` |
| 登录后仍判定未认证 | `!!tokens?.idToken` 判定逻辑 | `nav.component.ts` / `cognito.guard.ts` |
| 用户名/公司名空白 | `idToken.payload['custom:...']` 字段名 | `nav.component.ts` |
| 登出无效 | `signOut({ global: true })` | `*/auth.component.ts`、`nav.component.ts` |

## 4. 通过标准

三个应用均：可启动、登录页渲染、能登录、受保护请求带 token、可登出，且
Console 无致命报错 → 视为运行时验证通过，可合并分支。
