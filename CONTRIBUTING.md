# Contributing / 贡献指南

[English](#english) ｜ [中文](#中文)

Thanks for your interest in improving **AWS Serverless SaaS Quick Start**! This is a
community-maintained derivative of the
[AWS Serverless SaaS Workshop](https://github.com/aws-samples/aws-serverless-saas-workshop)
(based on its `Lab6`); see [`docs/CHANGES_FROM_WORKSHOP.md`](docs/CHANGES_FROM_WORKSHOP.md)
for how and why it diverged.

---

## English

### Code of Conduct

By participating you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

### Reporting bugs / requesting features

- Search [existing issues](../../issues) first to avoid duplicates.
- Open a new issue using the provided templates. Include reproduction steps,
  expected vs. actual behaviour, and your environment (OS, Python/Node versions).
- **Do not file security vulnerabilities as public issues** — follow
  [`SECURITY.md`](SECURITY.md) instead.

### Development setup

| Component | Requirement |
| --------- | ----------- |
| Backend   | Python 3.13 |
| Frontend  | Node.js 20.19+ or 22.12+ (Angular 20) |
| Infra     | AWS SAM CLI, Docker (for `sam build --use-container`), AWS CLI |

### Running the tests

The project ships cross-platform test suites (Windows / macOS / Linux). Full
details in [`docs/LOCAL_TESTING.md`](docs/LOCAL_TESTING.md).

```bash
# Backend — pytest + moto (in-memory DynamoDB, no Docker/AWS needed)
pip install -r requirements-test.txt
pytest

# Frontend — Playwright runtime smoke (build the three apps first, then)
cd e2e
npm install
npx playwright install chromium
npx playwright test
```

CI runs both on every pull request — see [`.github/workflows/`](.github/workflows).

### Submitting changes

`main` is a protected branch: **direct pushes are blocked and all changes must go
through a Pull Request**. Required status checks must pass before a PR can be
merged — the backend `pytest` suite on ubuntu/windows/macOS
(`backend-tests.yml`) and the frontend Playwright suite (`frontend-e2e.yml`).
These rules apply to everyone, maintainers included.

1. Fork the repository (or, if you have write access, create a topic branch);
   either way, branch off `main` (e.g. `fix/order-update-bug`,
   `feat/add-invoice-service`). Never push directly to `main`.
2. Make focused commits with clear messages. Keep unrelated changes in separate PRs.
3. Ensure `pytest` passes and, for frontend changes, that all three apps build
   (`npx ng build --configuration production`) and Playwright smoke tests pass.
   The same checks run in CI and must pass before merge.
4. Update docs (`README.md` / `README.zh-CN.md` and anything under `docs/`) when
   behaviour or setup changes.
5. Open a Pull Request using the template. Link any related issue. A maintainer
   merges it once the required checks are green.

### Coding conventions

- **Python**: follow the surrounding style; keep Lambda handlers thin and put
  data access in the `*_service_dal.py` layer. Pin new dependencies in the
  relevant `requirements.txt`.
- **Angular/TypeScript**: match the existing standalone-component + Material M3
  patterns. Don't reintroduce deprecated packages (e.g. `@angular/flex-layout`).
- **No secrets**: never commit Cognito pool/client IDs, API URLs, emails,
  passwords, or AWS account IDs. Use placeholders and document them in
  [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md).

### Licensing of contributions

This project is licensed under [MIT-0](LICENSE). By contributing, you agree that
your contributions are licensed under the same terms.

---

## 中文

### 行为准则

参与本项目即表示你同意遵守 [行为准则](CODE_OF_CONDUCT.md)。

### 报告问题 / 提出需求

- 提交前请先搜索 [已有 issue](../../issues)，避免重复。
- 使用提供的模板新建 issue，附上复现步骤、预期与实际行为、运行环境
  （操作系统、Python/Node 版本）。
- **安全漏洞请勿公开提交 issue**，请按 [`SECURITY.md`](SECURITY.md) 私下上报。

### 开发环境

| 组件 | 要求 |
| ---- | ---- |
| 后端 | Python 3.13 |
| 前端 | Node.js 20.19+ 或 22.12+（Angular 20） |
| 基础设施 | AWS SAM CLI、Docker（用于 `sam build --use-container`）、AWS CLI |

### 运行测试

项目提供跨平台测试套件（Windows / macOS / Linux），详见
[`docs/zh-CN/LOCAL_TESTING.md`](docs/zh-CN/LOCAL_TESTING.md)：

```bash
# 后端 —— pytest + moto（内存模拟 DynamoDB，无需 Docker / AWS）
pip install -r requirements-test.txt
pytest

# 前端 —— Playwright 运行时冒烟（先构建三个 app，再）
cd e2e
npm install
npx playwright install chromium
npx playwright test
```

CI 在每次 Pull Request 时运行二者，见 [`.github/workflows/`](.github/workflows)。

### 提交变更

`main` 是受保护分支：**禁止直接推送，所有改动都必须通过 Pull Request 合入**。合并前
必须通过所需的状态检查 —— 后端在 ubuntu/windows/macOS 上的 `pytest` 套件
（`backend-tests.yml`）以及前端的 Playwright 套件（`frontend-e2e.yml`）。该规则对所有
人生效，包括维护者。

1. Fork 仓库（若你拥有写权限，也可直接创建主题分支），无论哪种方式都从 `main` 切出主题
   分支（如 `fix/order-update-bug`）。切勿直接推送到 `main`。
2. 提交粒度清晰、信息明确；无关改动请拆分到不同 PR。
3. 确保 `pytest` 通过；前端改动需保证三个 app 均能构建并通过 Playwright 冒烟。相同的检查
   会在 CI 中运行，且必须在合并前通过。
4. 行为或配置变化时，同步更新文档（`README.md` / `README.zh-CN.md` 及 `docs/`）。
5. 使用模板提交 Pull Request，并关联相关 issue。所需检查全部通过后，由维护者完成合并。

### 编码约定

- **Python**：沿用现有风格；Lambda handler 保持精简，数据访问放在
  `*_service_dal.py` 层；新依赖在对应 `requirements.txt` 中固定版本。
- **Angular/TypeScript**：遵循现有 standalone 组件 + Material M3 模式，不要重新
  引入已废弃的包（如 `@angular/flex-layout`）。
- **不提交敏感信息**：切勿提交 Cognito 池/客户端 ID、API URL、邮箱、密码或 AWS
  账号 ID。使用占位符并在 [`docs/zh-CN/CONFIGURATION.md`](docs/zh-CN/CONFIGURATION.md) 中说明。

### 贡献的许可

本项目基于 [MIT-0](LICENSE) 许可。提交贡献即表示你同意以相同条款授权你的贡献。
