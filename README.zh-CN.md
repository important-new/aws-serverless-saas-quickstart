# AWS Serverless SaaS Quick Start

[English](README.md) ｜ [**中文**](README.zh-CN.md)

## 项目概述

这是一个基于AWS无服务器技术栈构建的多租户SaaS应用参考架构。该项目展示了如何在AWS云平台上实现可扩展、安全且成本效益高的SaaS解决方案，支持多种租户隔离模式（池化和专用）。

## 关于本项目与上游

本项目派生自 AWS 官方的 [AWS Serverless SaaS Workshop](https://github.com/aws-samples/aws-serverless-saas-workshop)（基于其 `Lab6`），并在其基础上做了**后端架构重构、数据模型简化、运行时与依赖升级、部署脚本增强**等大量修改，已作为独立衍生项目按 MIT-0 演进。

- 完整的差异清单与原因：[`docs/CHANGES_FROM_WORKSHOP.md`](docs/CHANGES_FROM_WORKSHOP.md)
- 版权溯源与署名：[`NOTICE`](NOTICE) ｜ 许可证：[`LICENSE`](LICENSE)（MIT-0）

## 核心特性

- **多租户架构**: 支持池化(Pooled)和专用(Silo)两种租户隔离模式
- **分层服务**: 支持Basic、Standard、Premium、Platinum四种服务等级
- **无服务器架构**: 基于AWS Lambda、API Gateway、DynamoDB等无服务器服务
- **身份认证**: 集成AWS Cognito进行用户身份管理
- **API限流**: 基于租户等级的API使用量控制
- **监控和日志**: 集成CloudWatch和X-Ray进行应用监控
- **自动化部署**: 使用AWS SAM和CDK进行基础设施即代码

## 技术架构

### 后端服务 (server/)
- **AWS Lambda**: 无服务器计算服务
- **API Gateway**: RESTful API管理和路由
- **DynamoDB**: NoSQL数据库存储
- **AWS Cognito**: 用户身份认证和授权
- **CloudFormation/SAM**: 基础设施即代码
- **Python 3.13**: 后端开发语言
- **PyJWT[crypto]**: Cognito JWT 校验（替代已停维护的 `python-jose`，规避 CVE-2024-33663/33664）

### 数据库设计规则

#### DynamoDB 表设计原则

基于AWS官方推荐的最佳实践，本项目采用简化的分区键设计，移除了复杂的分片策略，以提高性能和降低成本。

##### 核心设计原则

1. **均匀分布**: 使用租户ID作为分区键，确保数据均匀分布
2. **避免热点**: 每个租户独立分区，避免热点问题
3. **可预测访问**: 基于租户的访问模式更加可预测
4. **简化查询**: 无需复杂的并行查询逻辑

##### 标准表结构

```python
# 统一的数据模型设计
{
    "tenant_id": "tenant1",           # 分区键 (HASH)
    "entity_id": "uuid-123",         # 排序键 (RANGE)
    "entity_type": "PRODUCT",        # 实体类型标识
    "created_at": "2024-01-01T00:00:00Z",  # 创建时间
    "updated_at": "2024-01-01T00:00:00Z",  # 更新时间
    # ... 业务字段
}
```

##### CloudFormation 表定义

```yaml
# 标准表结构模板
TableName:
  Type: AWS::DynamoDB::Table
  Properties:
    AttributeDefinitions:
      - AttributeName: tenant_id
        AttributeType: S
      - AttributeName: entity_id
        AttributeType: S
    KeySchema:
      - AttributeName: tenant_id
        KeyType: HASH
      - AttributeName: entity_id
        KeyType: RANGE
    ProvisionedThroughput:
      ReadCapacityUnits: 5
      WriteCapacityUnits: 5
```

##### 查询策略

```python
# 标准查询模式
response = table.query(
    KeyConditionExpression=Key('tenant_id').eq(tenant_id),
    ReturnConsumedCapacity='TOTAL'
)
```

##### 性能优化考虑

- **小数据量**（< 1000个实体/租户）：简单查询足够
- **大数据量**（> 1000个实体/租户）：可考虑添加GSI
- **成本敏感**：当前设计最小化存储成本

##### 数据迁移策略

1. **备份现有数据**
2. **运行迁移脚本**
3. **验证迁移结果**
4. **更新应用程序代码**
5. **删除旧数据**

##### 监控指标

- 查询延迟
- 吞吐量
- 错误率
- 成本

##### 重构优势

✅ **极简设计** - 最少的字段和索引  
✅ **成本优化** - 减少存储和写入开销  
✅ **性能提升** - 简化查询逻辑  
✅ **易于维护** - 减少代码复杂度  
✅ **可扩展性** - 为未来增长预留空间

### 前端应用 (client/)
- **Angular 20**: 现代化Web应用框架（standalone 组件、Material M3 主题）
- **TypeScript 5.8**: 类型安全的JavaScript
- **Angular Material**: UI组件库
- **AWS Amplify v6** + **@aws-amplify/ui-angular 5**: 前端集成AWS服务（认证 UI）

## 项目结构

```
aws-serverless-saas-quickstart/
├── server/                              # 后端服务
│   ├── shared/                          # 共享(控制面)栈
│   │   ├── template.yaml                # 共享资源 CloudFormation/SAM 模板
│   │   ├── samconfig.toml               # SAM 配置(栈:saas-control-stack)
│   │   ├── nested_templates/            # 嵌套 CloudFormation 模板
│   │   ├── custom_resources/            # 自定义资源(如使用计划关联)
│   │   ├── layers/                      # Lambda 层依赖
│   │   ├── auth/                        # 授权器与共享鉴权资源
│   │   └── tenant-management/           # 租户注册 / 供应 / 用户管理
│   ├── services/                        # 租户(应用面)栈
│   │   ├── template.yaml                # 租户资源模板(嵌套应用)
│   │   ├── samconfig.toml               # SAM 配置(栈:stack-pooled)
│   │   ├── product-service/             # 产品管理服务
│   │   ├── order-service/               # 订单管理服务
│   │   └── tenant-api/                  # 租户 API 授权器 + 限流/监控
│   └── TenantPipeline/                  # 租户部署管道(CDK)
├── client/                              # 前端应用
│   ├── Admin/                           # 系统管理员界面
│   ├── Application/                     # 租户应用界面
│   └── Landing/                         # 着陆 / 注册页面
├── e2e/                                 # Playwright 跨平台冒烟测试
├── scripts/                             # 部署与辅助脚本
└── docs/                                # 详细文档(见下)
```

## 详细文档

本 README 为高层入口,深入的架构剖析位于 [`docs/`](docs/) 目录下:

- [`docs/ARCHITECTURE.md`](docs/zh-CN/ARCHITECTURE.md) —— 架构索引(技术栈、数据库设计、结构)
- [`docs/TENANT_MANAGEMENT.md`](docs/zh-CN/TENANT_MANAGEMENT.md) —— 平台租户管理实现(生命周期、用户/租户关联、权限控制、分级)
- [`docs/API_CONFIGURATION.md`](docs/zh-CN/API_CONFIGURATION.md) —— 管理端与租户端接口配置关系剖析
- [`docs/THROTTLING_AND_MONITORING.md`](docs/zh-CN/THROTTLING_AND_MONITORING.md) —— 监控运维、使用计划限流,以及 CloudWatch 限流指标机制
- [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) ｜ [`docs/LOCAL_TESTING.md`](docs/LOCAL_TESTING.md) ｜ [`docs/CHANGES_FROM_WORKSHOP.md`](docs/CHANGES_FROM_WORKSHOP.md) ｜ [`docs/DEPENDENCY_AUDIT.md`](docs/DEPENDENCY_AUDIT.md)

深度剖析的英文版位于 [`docs/`](docs/) 根目录。

## 核心服务说明

### 1. 产品服务 (server/services/product-service)
- 产品的 CRUD 操作
- 支持多租户数据隔离
- 集成监控和日志记录

### 2. 订单服务 (server/services/order-service)
- 订单的 CRUD 操作
- 订单产品关联管理
- 租户级别的数据访问控制

### 3. 租户 API (server/services/tenant-api)
- 租户请求授权(Lambda 授权器)
- 按租户的 API 限流与 CloudWatch 监控

### 4. 租户管理 (server/shared/tenant-management)
- 租户注册和配置
- 租户激活/停用
- 用户管理和权限控制
- 租户资源供应

### 5. 前端应用
- **Admin**(`client/Admin`):系统管理员控制台,管理租户和用户
- **Application**(`client/Application`):租户业务应用,管理产品和订单
- **Landing**(`client/Landing`):租户注册和登录页面

## 部署指南

### 前置条件
- AWS CLI 已配置
- AWS SAM CLI 已安装
- Node.js 20.19+ 或 22.12+ 已安装（Angular 20 要求）
- Docker 已安装（用于 SAM 构建）

> 后端拆分为两个栈:**共享 / 控制面**栈(`server/shared`)与
> **租户 / 应用面**栈(`server/services`)。请先部署共享栈。

### 1. 部署共享资源
```bash
cd server/shared
sam build -t template.yaml --use-container
sam deploy --config-file samconfig.toml
```

### 2. 部署租户资源（池化）
```bash
cd ../services
sam build -t template.yaml --use-container
sam deploy --config-file samconfig.toml
```

### 3.（可选）部署租户管道，用于 Platinum（专用）供应
```bash
cd ../TenantPipeline
npm install
cdk bootstrap
cdk deploy --require-approval never
```

### 4. 部署前端应用
```bash
# 管理员应用
cd client/Admin
npm install
npm run build

# 租户应用
cd ../Application
npm install
npm run build

# 着陆页面
cd ../Landing
npm install
npm run build
```

### 5. 配置和测试
```bash
cd scripts
./deployment.sh
./geturl.sh
```

## 租户隔离模式

### 池化模式 (Pooled)
- **适用等级**: Basic、Standard、Premium
- **特点**: 多个租户共享相同的基础设施
- **隔离方式**: 通过应用层逻辑实现数据隔离
- **优势**: 成本效益高，适合小型租户
- **用户池**: 共享Cognito用户池

### 专用模式 (Silo)
- **适用等级**: Platinum
- **特点**: 每个租户拥有独立的基础设施
- **隔离方式**: 物理级别的数据隔离
- **优势**: 更高的安全性，适合大型企业租户
- **用户池**: 独立Cognito用户池
- **基础设施**: 通过CodePipeline自动部署专用CloudFormation栈

## 服务等级

| 等级 | 隔离模式 | API限制 | 用户池 | 基础设施 | 适用场景 |
|------|----------|---------|--------|----------|----------|
| Basic | 池化 | 低 | 共享 | 共享 | 小型企业 |
| Standard | 池化 | 中等 | 共享 | 共享 | 中型企业 |
| Premium | 池化 | 高 | 共享 | 共享 | 大型企业 |
| Platinum | 专用 | 最高 | 独立 | 专用 | 企业级客户 |


## 安全特性

- **身份认证**: AWS Cognito用户池
- **API授权**: Lambda授权器
- **数据加密**: 传输和存储加密
- **网络安全**: VPC和安全组配置
- **访问控制**: IAM角色和策略

## 开发指南

### 本地开发
```bash
# 启动本地API
sam local start-api

# 启动前端开发服务器
cd client/Application
ng serve
```

### 测试

跨平台测试套件（Windows / macOS / Linux），详见 [`docs/LOCAL_TESTING.md`](docs/LOCAL_TESTING.md)：

```bash
# 后端：pytest + moto（内存模拟 DynamoDB，无需 Docker / AWS）
pip install -r requirements-test.txt
pytest

# 前端：Playwright 运行时冒烟（先各自 ng build，再）
cd e2e && npm install && npx playwright install chromium && npx playwright test
```

CI 见 `.github/workflows/`：`backend-tests.yml`（三平台 pytest）、`frontend-e2e.yml`（构建三个 app + Playwright）。

## 扩展和定制

### 添加新服务
1. 在`server/`目录下创建新的服务目录
2. 实现Lambda函数和数据访问层
3. 更新CloudFormation模板
4. 配置API Gateway路由

### 自定义租户配置
1. 修改租户表结构
2. 更新租户管理服务
3. 调整前端管理界面

## 故障排除

### 常见问题
1. **部署失败**: 检查AWS权限和配额
2. **API调用失败**: 验证API密钥和授权配置
3. **前端无法访问**: 检查CORS配置和CloudFront分发

### 调试工具
- CloudWatch日志
- X-Ray追踪
- API Gateway测试控制台

## 贡献指南

欢迎贡献！请先阅读 [`CONTRIBUTING.md`](CONTRIBUTING.md) 与 [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)。
安全问题请按 [`SECURITY.md`](SECURITY.md) 私下上报。版本变更见 [`CHANGELOG.md`](CHANGELOG.md)。

## 许可证

本项目基于 [MIT-0](LICENSE) 许可证开源。上游溯源与署名见 [`NOTICE`](NOTICE)，
与上游 Workshop 的差异见 [`docs/CHANGES_FROM_WORKSHOP.md`](docs/CHANGES_FROM_WORKSHOP.md)。

## 相关资源

- [AWS Serverless Application Model (SAM)](https://aws.amazon.com/serverless/sam/)
- [AWS Lambda](https://aws.amazon.com/lambda/)
- [Amazon API Gateway](https://aws.amazon.com/api-gateway/)
- [Amazon DynamoDB](https://aws.amazon.com/dynamodb/)
- [AWS Cognito](https://aws.amazon.com/cognito/)
- [Angular Framework](https://angular.io/)

## 支持

如有问题或建议，请通过GitHub Issues提交反馈。
