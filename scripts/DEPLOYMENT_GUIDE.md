# SAM部署指南

## 使用单一配置文件的多环境配置

### 配置文件结构

```toml
version = 0.1

# 生产环境
[prod]
[prod.deploy]
[prod.deploy.parameters]
stack_name = "saas-control-stack-prod"
parameter_overrides = "Environment=prod"

# 开发环境
[dev]
[dev.deploy]
[dev.deploy.parameters]
stack_name = "saas-control-stack-dev"
parameter_overrides = "Environment=dev"

# 测试环境
[stage]
[stage.deploy]
[stage.deploy.parameters]
stack_name = "saas-control-stack-stage"
parameter_overrides = "Environment=stage"
```

### 部署命令

```bash
# 部署到生产环境
sam deploy --config-env prod

# 部署到开发环境
sam deploy --config-env dev

# 部署到测试环境
sam deploy --config-env stage
```

## 环境配置差异

### 生产环境 (prod)
- Stack名称: `saas-control-stack-prod`
- S3前缀: `saas-control-prod`
- 参数: `Environment=prod`
- 确认变更集: `false`

### 开发环境 (dev)
- Stack名称: `saas-control-stack-dev`
- S3前缀: `saas-control-dev`
- 参数: `Environment=dev`
- 确认变更集: `false`

### 测试环境 (stage)
- Stack名称: `saas-control-stack-stage`
- S3前缀: `saas-control-stage`
- 参数: `Environment=stage`
- 确认变更集: `false`

## 环境特定参数

### 在template.yaml中使用环境参数

```yaml
Parameters:
  Environment:
    Type: String
    Default: prod
    AllowedValues:
      - prod
      - dev
      - stage
    Description: Environment name

Resources:
  MyFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub "my-function-${Environment}"
      Environment:
        Variables:
          ENVIRONMENT: !Ref Environment
```

### 条件资源

```yaml
Conditions:
  IsProd: !Equals [!Ref Environment, prod]
  IsDev: !Equals [!Ref Environment, dev]

Resources:
  # 只在生产环境创建
  ProdOnlyResource:
    Type: AWS::S3::Bucket
    Condition: IsProd
    Properties:
      BucketName: !Sub "prod-only-bucket-${Environment}"

  # 只在开发环境创建
  DevOnlyResource:
    Type: AWS::S3::Bucket
    Condition: IsDev
    Properties:
      BucketName: !Sub "dev-only-bucket-${Environment}"
```

## CI/CD集成

### GitHub Actions示例

```yaml
name: Deploy to Environment

on:
  push:
    branches:
      - main
      - develop
      - staging

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy to environment
        run: |
          if [[ ${{ github.ref }} == 'refs/heads/main' ]]; then
            ./scripts/deploy-all.sh prod
          elif [[ ${{ github.ref }} == 'refs/heads/develop' ]]; then
            ./scripts/deploy-all.sh dev
          elif [[ ${{ github.ref }} == 'refs/heads/staging' ]]; then
            ./scripts/deploy-all.sh stage
          fi
```

### AWS CodePipeline示例

```yaml
version: 0.2

phases:
  build:
    commands:
      - echo "Deploying to $ENVIRONMENT"
      - ./scripts/deploy-all.sh $ENVIRONMENT
```

## 最佳实践

### 1. 环境隔离
- 使用不同的Stack名称
- 使用不同的S3前缀
- 使用不同的参数值

### 2. 安全性
- 生产环境使用更严格的IAM权限
- 开发环境可以更宽松以便调试

### 3. 成本控制
- 开发环境使用较小的实例
- 生产环境使用适当的实例大小

### 4. 监控
- 为每个环境设置不同的CloudWatch日志组
- 使用不同的SNS主题进行通知

## 故障排除

### 常见问题

1. **Stack名称冲突**
   ```bash
   # 确保每个环境使用不同的Stack名称
   sam deploy --stack-name my-stack-prod
   ```

2. **S3前缀冲突**
   ```bash
   # 使用环境特定的S3前缀
   sam deploy --s3-prefix my-app-prod
   ```

3. **参数覆盖问题**
   ```bash
   # 确保参数值正确
   sam deploy --parameter-overrides Environment=prod
   ```

### 调试命令

```bash
# 查看当前配置
sam config list

# 验证模板
sam validate

# 查看变更集
sam deploy --no-execute-changeset

# 查看Stack状态
aws cloudformation describe-stacks --stack-name my-stack-prod
``` 