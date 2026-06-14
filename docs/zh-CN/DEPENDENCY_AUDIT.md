# 依赖与运行时支持状态审计

[English](../DEPENDENCY_AUDIT.md) ｜ [**中文**](DEPENDENCY_AUDIT.md)

[← 返回 README](../../README.zh-CN.md)

> 审计日期：2026-06-14　｜　对照"当前社区维护 / AWS 官方支持"状态

## 总体结论

- **后端 / 基础设施**：运行时选型健康，当前受支持。
- **前端**：Angular / Amplify 技术栈整体已 **EOL（生命周期结束）**，停留在 2022 年版本。
- **最高优先安全项**：`python-jose` 已弃维且存在活跃 CVE，需替换。

---

## 1. 后端 / 基础设施（✅ 大体良好）

| 组件 | 代码中版本 | 状态 | 说明 |
|---|---|---|---|
| Lambda runtime | `python3.13` | ✅ 当前受支持 | AWS 支持至约 2029-10；最新已是 3.14（2025-11），3.13 为稳妥 LTS |
| CodeBuild 镜像 | `STANDARD_7_0` + `python:3.13` | ✅ 可用 | Python 3.13 自 2025-03 起内置于 standard:7.0 |
| `aws-cdk-lib` | `^2.0.0` | ✅ 受支持 | CDK v2 在维护（v1 已 2023-06 EOL）。floor 偏低，建议核对 lockfile 解析到最新 2.x |
| `constructs` | `^10.0.0` | ✅ | 与 CDK v2 匹配 |
| `aws-lambda-powertools` `jsonpickle` `simplejson` `requests` `pytest-mock` | 未锁版本 | ✅ 维护中 | — |

## 2. 后端需要注意（⚠️ / ❌）

| 项 | 状态 | 影响位置 | 处置 |
|---|---|---|---|
| **`python-jose[cryptography]`** | ❌ 弃维 + CVE | `services/tenant-api`、`shared/auth`、`shared/layers` | **迁移到 `PyJWT`**。涉及 JWT 校验（安全敏感路径）。相关 CVE：CVE-2024-33663（算法混淆）、CVE-2024-33664（JWE DoS） |
| **Python 依赖未锁版本** | ⚠️ 可复现性/供应链风险 | 全部 `requirements.txt` | 固定大版本或引入 lock（pip-tools） |
| `crhelper` / `aws_requests_auth` | ⚠️ 低活跃 | `shared/custom_resources`、多处 | 仍可用，留意 |
| `@types/node` | ⚠️ `10.17.27`（Node 10 已 2021 EOL） | `TenantPipeline` | 升级到与构建 Node 对应的 `@types/node`（仅类型，运行时无影响） |

## 3. 前端（❌ 整体 EOL）

| 组件 | 代码中版本 | 状态 | 当前/目标 |
|---|---|---|---|
| `@angular/core` / `@angular/cli` | `~14.0.0` / `~14.0.5` | ❌ EOL（约 2023 年底） | 在维护：20（至 2026-11）/ 21（至 2027-05）/ 22 |
| `aws-amplify` | `~4.3.27` | ❌ EOL | 仅 v5/v6 受支持 |
| `@aws-amplify/ui-angular` | `~2.4.14` | ❌ 远古 | 最新 5.3.5，要求 Angular ≥ 19 |
| `typescript` | `~4.7.2` | ⚠️ 旧（被 Angular 14 锁定） | 5.x |
| `rxjs` / `zone.js` | `7.5` / `0.11.4` | ⚠️ 旧（随 Angular 14 绑定） | — |

> 前端为互锁技术栈：Angular 14 ↔ Amplify v4 ↔ ui-angular 2.x ↔ TS 4.7。
> 现代化需整体跃迁：Angular `14→20/21`、aws-amplify `v4→v6`、ui-angular `2.x→5.x`
> （ui-angular 5.x 需 Angular 19+）。其中 **Amplify v4→v6 的 Auth API 为破坏性重写**，工作量最大，应作为独立迁移项目并配合构建/E2E 验证。

---

## 4. 处置优先级

| 级别 | 事项 | 风险/工作量 |
|---|---|---|
| 🔴 P0（安全） | `python-jose` → `PyJWT` | 中，需改 JWT 校验代码并测试 |
| 🟠 P1（可复现） | Python 依赖锁定版本 | 低 |
| 🟢 P2（杂项） | `@types/node` 升级、CDK lockfile 核对 | 低 |
| 🟡 P3（大工程） | 前端 Angular 20/21 + Amplify v6 + ui-angular 5.x 整体升级 | 高，破坏性，需单独立项 |

## 4.1 处置进度（2026-06-14，分支 `chore/dependency-modernization`）

| 级别 | 状态 | 说明 |
|---|---|---|
| 🔴 P0 | ✅ 完成 | `python-jose` → `PyJWT[crypto]`，重写两个 authorizer 验签；6 用例单元验证通过 |
| 🟠 P1 | ✅ 完成 | 全部 `requirements.txt` 锁版本（兼容区间锁大版本） |
| 🟢 P2 | ✅ 完成 | `@types/node`→`^20`、`aws-cdk-lib`→`^2.258` 并刷新 lockfile；修 `\*` 转义 |
| 🟡 P3 | ✅ 完成（构建层） | **三个前端应用全部 Angular 14 → 20**；Admin/Application 同时 **Amplify v4 → v6**、ui-angular 2→5；移除已废弃的 `@angular/flex-layout`；生产构建均通过 |

### 前端迁移要点
- 统一各 `@angular/*` 至 `^20`、TypeScript `5.8`、zone.js `0.15`、rxjs `7.8`。
- Material：移除已删的 `legacy-*` 导入；主题改用 M3 `mat.theme()`（indigo→violet、pink→rose，视觉相近）。
- Angular 19 起组件默认 standalone：给 NgModule 声明的组件补 `standalone: false`。
- Amplify v6：`Auth.currentSession()`→`fetchAuthSession()`、`getJwtToken()`→`token.toString()`、`isValid()`→`!!tokens?.idToken`、`Auth.signOut()`→`signOut()`；`Amplify.configure(aws_exports)` 旧格式 v6 仍兼容。
- SCSS 去除 webpack `~` 前缀；ui-angular 5 的 `theme.css` 经 angular.json `styles` 引入（其 exports 字段不暴露该子路径）。

### ⚠️ 尚未验证（需运行时确认）
- 生产构建通过 ≠ 运行时通过。**Amplify v6 的登录/会话/登出流程需在浏览器实测**（`npm start` + 真实 Cognito 登录）。
- 后端 PyJWT 为独立单元验证，**未在已部署的 Lambda 中集成测试**。
- Material 主题色由 indigo 变为 violet（如需精确品牌色需自定义 M3 调色板）。

## 5. 信息来源

- AWS Lambda runtimes：<https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html>
- Lambda 增加 Python 3.13：<https://aws.amazon.com/about-aws/whats-new/2024/11/aws-lambda-support-python-313/>
- CodeBuild 增加 Python 3.13（standard:7.0）：<https://aws.amazon.com/about-aws/whats-new/2025/03/aws-codebuild-node-22-python-3-13-go-1-23>
- python-jose CVE-2024-33663：<https://www.vicarius.io/vsociety/posts/algorithm-confusion-in-python-jose-cve-2024-33663>
- PyJWT 迁移指引：<https://github.com/jpadilla/pyjwt/issues/942>
- Angular 版本与 EOL：<https://www.herodevs.com/blog-posts/angular-version-history-every-release-date-support-window-and-end-of-life-date-from-angularjs-to-angular-22>
- @aws-amplify/ui-angular（npm registry）：<https://registry.npmjs.org/@aws-amplify/ui-angular/latest>
