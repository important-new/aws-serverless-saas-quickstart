# Security Policy / 安全策略

[English](#english) ｜ [中文](#中文)

## English

### Supported Versions

This project is a reference architecture and quick-start derived from the AWS
Serverless SaaS Workshop. It is community-maintained and licensed under MIT-0.

Only the latest `main` branch is supported. There are no tagged releases and no
backported security patches for older commits. Fixes land on `main`; if you are
running an older checkout, please update to the latest `main`.

| Version | Supported |
| --- | --- |
| `main` (latest) | ✅ |
| Older commits / forks | ❌ |

### Reporting a Vulnerability

**Please do not open public GitHub issues for security vulnerabilities.**
Public issues disclose the problem before a fix is available.

Instead, report privately using either of the following:

1. **GitHub private vulnerability reporting** — go to the repository's
   **Security** tab and choose **Report a vulnerability**. This opens a private
   advisory visible only to you and the maintainers.
2. **Contact the maintainer privately** — reach out to the maintainer
   [@important-new](https://github.com/important-new) directly.

This process complements the general guidance in
[CONTRIBUTING.md](CONTRIBUTING.md); use private reporting for anything
security-sensitive rather than the normal contribution flow.

### What to Include in a Report

To help us triage and reproduce the issue quickly, please include:

- **Affected component / file** — the specific service, module, or file path.
- **Reproduction steps** — a minimal, step-by-step description to reproduce.
- **Impact** — what an attacker could achieve (data exposure, privilege
  escalation, denial of service, etc.).
- **Suggested fix** — any patch, mitigation, or remediation idea, if you have one.

### Response Expectations

This is a volunteer-maintained, best-effort project. We aim to acknowledge new
reports within a few business days. Investigation and fix timelines are
best-effort and depend on maintainer availability and severity.

### Production Use Disclaimer

This repository is **reference and sample code** intended for learning and as a
starting point for your own work. It is **not** a hardened, production-ready
product.

If you deploy any part of this project to production, **you are responsible for
your own security review**, including (but not limited to):

- IAM least-privilege policies and scoping
- Secrets management (no secrets in source; use a secrets manager / parameter store)
- Dependency scanning and patching
- Network, logging, and monitoring controls appropriate to your environment

### Credentials and Dependency Advisories

- **Never commit hardcoded credentials** (passwords, API keys, tokens) to the
  repository. Use environment variables, parameter stores, or a secrets manager.
- Known dependency advisories and remediations are tracked in
  [docs/DEPENDENCY_AUDIT.md](docs/DEPENDENCY_AUDIT.md). For example, the
  migration off the unmaintained `python-jose` to `PyJWT[crypto]` to avoid
  CVE-2024-33663 and CVE-2024-33664 is documented there.

This project is distributed under the terms in [LICENSE](LICENSE).

## 中文

### 受支持的版本

本项目是基于 AWS Serverless SaaS Workshop 衍生的参考架构与快速入门模板，由社区维护，
采用 MIT-0 许可证。

仅支持最新的 `main` 分支。本项目没有发布带标签的版本，也不会为较旧的提交提供安全补丁的
回溯（backport）。所有修复都会合入 `main`；如果你正在使用较旧的检出版本，请更新到最新的
`main`。

| 版本 | 是否受支持 |
| --- | --- |
| `main`（最新） | ✅ |
| 较旧的提交 / 分叉（fork） | ❌ |

### 如何报告漏洞

**请勿为安全漏洞创建公开的 GitHub issue。**
公开的 issue 会在修复方案就绪之前暴露问题。

请改用以下任一方式进行私密报告：

1. **GitHub 私密漏洞报告** —— 进入仓库的 **Security（安全）** 标签页，选择
   **Report a vulnerability（报告漏洞）**。这会创建一份仅你与维护者可见的私密安全公告。
2. **私下联系维护者** —— 直接联系维护者
   [@important-new](https://github.com/important-new)。

该流程是对 [CONTRIBUTING.md](CONTRIBUTING.md) 中通用指南的补充；任何涉及安全敏感的内容，
请使用上述私密报告渠道，而不要走常规的贡献流程。

### 报告中应包含的内容

为帮助我们快速分类与复现问题，请在报告中包含：

- **受影响的组件 / 文件** —— 具体的服务、模块或文件路径。
- **复现步骤** —— 用于复现问题的最小化、分步说明。
- **影响** —— 攻击者可能造成的后果（数据泄露、权限提升、拒绝服务等）。
- **建议的修复方案** —— 如有，请提供任何补丁、缓解措施或修复思路。

### 响应预期

本项目由志愿者维护，尽力而为。我们力争在数个工作日内确认收到新的报告。调查与修复的时间
表均为尽力而为，取决于维护者的可用时间与问题的严重程度。

### 生产环境使用免责声明

本仓库为**参考与示例代码**，旨在用于学习以及作为你自身工作的起点。它**并非**经过加固的、
可直接用于生产的产品。

如果你将本项目的任何部分部署到生产环境，**你需要自行负责安全审查**，包括但不限于：

- IAM 最小权限策略及其范围限定
- 密钥管理（源代码中不得包含密钥；请使用密钥管理服务 / 参数存储）
- 依赖扫描与修补
- 适合你所处环境的网络、日志与监控控制

### 凭据与依赖安全公告

- **切勿将硬编码的凭据**（密码、API 密钥、令牌）提交到仓库。请使用环境变量、参数存储或
  密钥管理服务。
- 已知的依赖安全公告及其修复方案记录在
  [docs/DEPENDENCY_AUDIT.md](docs/DEPENDENCY_AUDIT.md) 中。例如，为避免 CVE-2024-33663
  与 CVE-2024-33664，从无人维护的 `python-jose` 迁移到 `PyJWT[crypto]` 的过程便记录于此。

本项目依据 [LICENSE](LICENSE) 中的条款进行分发。
