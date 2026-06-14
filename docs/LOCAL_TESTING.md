# 免费本地后端测试（无需 AWS 账号）

在本地真实跑后端服务，验证 Lambda handler + DAL + DynamoDB 读写——零成本、
不碰真实 AWS。提供两种方式。

> 注意：两种方式都**不含 Cognito**。真实登录依赖 Cognito（无免费本地方案，见
> `docs/MIGRATION_VERIFICATION.md`）。均通过 `requestContext.authorizer`
> 注入假的鉴权上下文（`tenantId`/`userRole`）来绕过 authorizer。

## 方式一（推荐，跨平台）：pytest + moto

纯 Python，**Windows/macOS/Linux 通用，无需 Docker、无需 AWS**。`moto` 在内存里
模拟 DynamoDB。两条命令：

```bash
pip install -r requirements-test.txt
pytest
```

- 测试位于 `server/services/*/tests/test_*.py`：直接 import handler、用 moto mock
  DynamoDB、断言 CRUD（含 update 回归测试，锁住已修复的 3 个 bug）。
- 共享设置见 `server/conftest.py`（把共享层与各服务 `src/` 加进 `sys.path`，并在
  import 前设好环境变量）。
- CI：`.github/workflows/backend-tests.yml` 在 ubuntu/windows/macOS 三平台跑 `pytest`。

写测试套件、跑 CI 首选此方式。下面的 DynamoDB Local 更保真但更重、依赖 Docker 与
Git Bash（非跨平台），适合偶尔高保真验证。

## 方式二（高保真）：DynamoDB Local + sam local invoke

### 前置
- Docker 运行中
- SAM CLI（`pip install aws-sam-cli`）
- 本地 Python + boto3（`pip install boto3`）

## 一键运行（product-service 全 CRUD）
```bash
bash scripts/local-test-product.sh
```
脚本会：起 DynamoDB Local（`-sharedDb`）→ 建 `Product-pooled` 表 → 构建 →
依次 invoke create/get/update/list/delete，最后自动还原临时改动。
停止本地库：`docker rm -f ddb-local`。

## 关键坑（手动操作时务必注意）

1. **DynamoDB Local 要加 `-sharedDb`**：否则按"凭证+区域"隔离数据库文件，
   建表方和函数看到的不是同一个库。
   ```bash
   docker run -d --network saas-local --name ddb-local -p 8000:8000 \
     amazon/dynamodb-local -jar DynamoDBLocal.jar -inMemory -sharedDb -port 8000
   ```

2. **`sam local invoke --env-vars` 只能覆盖模板里已声明的环境变量**。
   `AWS_ENDPOINT_URL_DYNAMODB`（让函数 boto3 指向本地库）若不在模板里，
   不会被注入。所以需临时把它加进 `template.yaml` 的 `Globals.Function.Environment`：
   ```yaml
   AWS_ENDPOINT_URL_DYNAMODB: "http://ddb-local:8000"
   ```
   （脚本会自动加、用完 `git checkout` 还原。）

3. **函数容器要接入同一 Docker 网络**：`sam local invoke ... --docker-network saas-local`，
   这样函数里用主机名 `ddb-local` 能解析到 DynamoDB Local 容器。

4. **关掉 X-Ray**：env 里设 `POWERTOOLS_TRACE_DISABLED=true`，避免本地无 X-Ray daemon 报噪。

## 已验证结果（2026-06-14）

product-service 五个操作全部 `statusCode 200`：create / get / get_products /
update / delete。本地测试还**发现并修复了 update 的两个预先存在 bug**
（`datetime` 误用、`ReturnValues=UPDATED_NEW`）——见 commit `b61c780`。

order-service 为相同代码模式，已应用相同修复（可仿照本脚本建 `Order-pooled` 表后同样验证）。
