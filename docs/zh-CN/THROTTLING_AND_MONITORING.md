[English](../THROTTLING_AND_MONITORING.md) ｜ [**中文**](THROTTLING_AND_MONITORING.md)

[← 返回 README](../../README.zh-CN.md)

---

## 监控和运维

### 日志记录
- 所有Lambda函数集成结构化日志
- 租户上下文信息自动记录
- CloudWatch日志集中管理

### 性能监控
- X-Ray分布式追踪
- CloudWatch指标监控
- API Gateway访问日志

### 告警配置
- API限流告警
- 错误率监控
- 性能阈值告警

### API限流和使用计划管理

#### UpdateUsagePlanFunction 功能分析

**主要作用**: `UpdateUsagePlanFunction` 是一个自定义资源Lambda函数，用于**将租户的API Gateway与相应的使用计划(Usage Plan)关联**，实现基于租户等级的API限流和配额控制。

#### 🔄 核心功能

**动态关联使用计划**:
```python
def do_action(event, _):
    """ Usage plans are created as part of bootstrap template.
        This method associates the usage plans for various tiers with tenant Apis
    """
    api_id = event['ResourceProperties']['ApiGatewayId']
    is_pooled_deploy = event['ResourceProperties']['IsPooledDeploy']
    usage_plan_id_basic = event['ResourceProperties']['UsagePlanBasicTier']
    usage_plan_id_standard = event['ResourceProperties']['UsagePlanStandardTier']
    usage_plan_id_premium = event['ResourceProperties']['UsagePlanPremiumTier']
    usage_plan_id_platinum = event['ResourceProperties']['UsagePlanPlatinumTier']
```

**基于部署模式的关联策略**:

**池化部署 (Pooled Deploy)**:
```python
if(is_pooled_deploy == "true"):
    # 池化租户共享所有等级的使用计划
    response_apigateway = apigateway.update_usage_plan(
        usagePlanId=usage_plan_id_basic,
        patchOperations=[
            {
                'op':'add',
                'path':'/apiStages',
                'value': api_id + ":" + stage
            }
        ]
    )
    # 同样关联Standard、Premium等级
```

**专用部署 (Silo Deploy)**:
```python
else:
    # 专用租户只关联Platinum等级使用计划
    response_apigateway = apigateway.update_usage_plan(
        usagePlanId=usage_plan_id_platinum,
        patchOperations=[
            {
                'op':'add',
                'path':'/apiStages',
                'value': api_id + ":" + stage
            }
        ]
    )
```

#### 🎯 使用计划等级配置

**Basic Tier (基础等级)**:
```yaml
UsagePlanBasicTier:
  Properties:
    Quota:
      Limit: 500        # 每日500次请求
      Period: DAY
    Throttle:
      BurstLimit: 50    # 突发限制50次
      RateLimit: 50     # 每秒50次
```

**Standard Tier (标准等级)**:
```yaml
UsagePlanStandardTier:
  Properties:
    Quota:
      Limit: 3000       # 每日3000次请求
      Period: DAY
    Throttle:
      BurstLimit: 100   # 突发限制100次
      RateLimit: 75     # 每秒75次
```

**Premium Tier (高级等级)**:
```yaml
UsagePlanPremiumTier:
  Properties:
    Quota:
      Limit: 5000       # 每日5000次请求
      Period: DAY
    Throttle:
      BurstLimit: 200   # 突发限制200次
      RateLimit: 100    # 每秒100次
```

**Platinum Tier (白金等级)**:
```yaml
UsagePlanPlatinumTier:
  Properties:
    Quota:
      Limit: 10000      # 每日10000次请求
      Period: DAY
    Throttle:
      BurstLimit: 300   # 突发限制300次
      RateLimit: 300    # 每秒300次
```

#### 🔄 执行流程

**CloudFormation自定义资源**:
```yaml
AssociateUsagePlanWithTenantAPI:
  Type: Custom::AssociateUsagePlanWithTenantAPI
  DependsOn: UpdateUsagePlanFunction
  Properties:
    ServiceToken: !GetAtt UpdateUsagePlanFunction.Arn
    ApiGatewayId: !Ref ApiGatewayTenantApi
    IsPooledDeploy: !If [IsPooledDeploy, true, false]
    Stage: !Ref StageName
    UsagePlanBasicTier: !ImportValue Serverless-SaaS-UsagePlanBasicTier
    UsagePlanStandardTier: !ImportValue Serverless-SaaS-UsagePlanStandardTier
    UsagePlanPremiumTier: !ImportValue Serverless-SaaS-UsagePlanPremiumTier
    UsagePlanPlatinumTier: !ImportValue Serverless-SaaS-UsagePlanPlatinumTier
```

**Lambda函数执行**:
- **创建时**: 执行 `do_action` 函数，关联使用计划
- **更新时**: 执行 `do_nothing` 函数，不做任何操作
- **删除时**: 执行 `do_nothing` 函数，不做任何操作

#### 🛡️ 权限配置

```yaml
UpdateUsagePlanLambdaExecutionRole:
  Policies:
    - PolicyName: update-usage-plan-policy
      PolicyDocument:
        Statement:
          - Effect: Allow
            Action:
              - apigateway:PATCH
            Resource: !Sub arn:aws:apigateway:${AWS::Region}::/usageplans/*
          - Effect: Allow
            Action:
              - dynamodb:GetItem
            Resource: !Sub arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/ServerlessSaaS-Settings
```

#### 🎯 业务价值

**多租户API限流**:
- **池化租户**: 共享基础设施，通过使用计划控制API访问频率
- **专用租户**: 独立基础设施，享受最高等级的使用计划

**服务等级差异化**:
- **Basic**: 适合小型企业，限制较严格
- **Standard**: 适合中型企业，平衡性能和成本
- **Premium**: 适合大型企业，较高性能
- **Platinum**: 适合企业级客户，最高性能

**成本控制**:
- 通过API限流防止资源滥用
- 基于使用量进行计费
- 支持突发流量处理

**监控和告警**:
```yaml
ThrottlingLimitExceeded:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmDescription: Throttling limit exceeded errors
    MetricName: !Join ['-', ["ThrottlingLimitExceeded", !Ref TenantIdParameter]]
    Namespace: "Serverless-SaaS-Reference-Architecture"
```

#### 🔗 与其他组件的关联

| 组件 | 关联方式 | 作用 |
|------|----------|------|
| **API Gateway** | 通过API ID关联 | 为租户API应用限流策略 |
| **使用计划** | 通过Usage Plan ID关联 | 定义限流和配额规则 |
| **CloudWatch** | 监控告警 | 监控限流事件 |
| **DynamoDB** | 配置存储 | 存储租户配置信息 |

#### 📈 总结

`UpdateUsagePlanFunction` 是多租户SaaS架构中的关键组件，它实现了：

1. **动态限流**: 根据租户等级自动应用不同的API限流策略
2. **服务差异化**: 通过使用计划实现服务等级的差异化
3. **资源保护**: 防止API滥用，保护系统资源
4. **成本优化**: 基于使用量进行精确的成本控制
5. **监控告警**: 提供完整的限流监控和告警机制

这种设计确保了多租户SaaS平台能够为不同等级的客户提供差异化的服务体验，同时保护系统资源不被滥用。

## API限流监控机制

### 🎯 ThrottlingLimitExceeded Metric 定义

#### 📍 定义位置

**文件**: `server/services/tenant-api/template.yaml`  
**行号**: 109-119

#### 🔧 Metric Filter 配置

```yaml
ThrottlingLimitMetricFilter:
  Type: AWS::Logs::MetricFilter
  Properties:
    LogGroupName: 
      Ref: "ApiGatewayAccessLogs"
    FilterPattern: '{$.status = "429"}'
    MetricTransformations:
      - 
        MetricValue: "1"
        MetricNamespace: "Serverless-SaaS-Reference-Architecture"
        MetricName: !Join ['-', ["ThrottlingLimitExceeded", !Ref TenantIdParameter]]
```

### 🔄 工作原理

#### 1. **数据源**
```yaml
LogGroupName: 
  Ref: "ApiGatewayAccessLogs"
```
- **来源**: API Gateway访问日志
- **日志组**: `/aws/api-gateway/access-logs-serverless-saas-tenant-api-{tenantId}`

#### 2. **过滤模式**
```yaml
FilterPattern: '{$.status = "429"}'
```
- **作用**: 过滤HTTP状态码为429的日志条目
- **含义**: 429 = "Too Many Requests" (限流响应)

#### 3. **指标转换**
```yaml
MetricTransformations:
  - 
    MetricValue: "1"                                    # 每次限流事件计为1
    MetricNamespace: "Serverless-SaaS-Reference-Architecture"  # 指标命名空间
    MetricName: !Join ['-', ["ThrottlingLimitExceeded", !Ref TenantIdParameter]]  # 指标名称
```

### 🔄 完整流程

#### 1. **API Gateway访问日志**
```json
{
  "requestId": "abc123",
  "ip": "192.168.1.1",
  "status": "429",  // 限流响应
  "httpMethod": "GET",
  "resourcePath": "/orders",
  "responseLength": "0"
}
```

#### 2. **Metric Filter处理**
```
日志条目 → FilterPattern匹配 → 生成指标
{$.status = "429"} → 匹配成功 → ThrottlingLimitExceeded-{tenantId} = 1
```

#### 3. **CloudWatch指标**
```
指标名称: ThrottlingLimitExceeded-{tenantId}
命名空间: Serverless-SaaS-Reference-Architecture
值: 1 (每次限流事件)
```

#### 4. **告警触发**
```yaml
ThrottlingLimitExceeded:
  Type: AWS::CloudWatch::Alarm
  Properties:
    MetricName: !Join ['-', ["ThrottlingLimitExceeded", !Ref TenantIdParameter]]
    Namespace: "Serverless-SaaS-Reference-Architecture"
    Threshold: 0
    Statistic: SampleCount  # 统计60秒内的事件次数
```

### 🔧 关键组件关联

#### 1. **API Gateway配置**
```yaml
ApiGatewayTenantApi:
  Properties:
    AccessLogSetting:
      DestinationArn: !GetAtt ApiGatewayAccessLogs.Arn
      Format: '{ "requestId":"$context.requestId", "ip": "$context.identity.sourceIp", "caller":"$context.identity.caller", "user":"$context.identity.user","requestTime":"$context.requestTime", "httpMethod":"$context.httpMethod","resourcePath":"$context.resourcePath", "status":"$context.status","protocol":"$context.protocol", "responseLength":"$context.responseLength" }'
```

#### 2. **日志组**
```yaml
ApiGatewayAccessLogs:
  Type: AWS::Logs::LogGroup
  Properties:
    LogGroupName: !Join ['-', [/aws/api-gateway/access-logs-serverless-saas-tenant-api-, !Ref TenantIdParameter]]
    RetentionInDays: 30
```

#### 3. **Metric Filter**
```yaml
ThrottlingLimitMetricFilter:
  Type: AWS::Logs::MetricFilter
  Properties:
    LogGroupName: !Ref "ApiGatewayAccessLogs"
    FilterPattern: '{$.status = "429"}'
    MetricTransformations:
      - MetricValue: "1"
        MetricNamespace: "Serverless-SaaS-Reference-Architecture"
        MetricName: !Join ['-', ["ThrottlingLimitExceeded", !Ref TenantIdParameter]]
```

### 🎯 设计优势

#### 1. **自动化监控**
- 无需手动编写代码
- 基于日志自动生成指标
- 实时监控限流事件

#### 2. **租户隔离**
- 每个租户有独立的指标名称
- 便于隔离监控和告警
- 支持租户级别的分析

#### 3. **成本效益**
- 利用现有的访问日志
- 无需额外的监控代码
- 高效的日志过滤机制

#### 4. **可扩展性**
- 易于添加新的过滤条件
- 支持复杂的日志模式匹配
- 可扩展到其他类型的监控

### 📊 监控效果

#### 1. **实时性**
- 日志产生后立即处理
- 指标实时更新
- 告警快速触发

#### 2. **准确性**
- 基于实际的HTTP响应状态
- 过滤条件精确匹配
- 避免误报和漏报

#### 3. **可追溯性**
- 保留完整的访问日志
- 支持历史数据分析
- 便于问题诊断

### 🔍 验证方法

#### 1. **查看日志组**
```bash
aws logs describe-log-groups --log-group-name-prefix "/aws/api-gateway/access-logs-serverless-saas-tenant-api-"
```

#### 2. **查看指标**
```bash
aws cloudwatch list-metrics --namespace "Serverless-SaaS-Reference-Architecture" --metric-name "ThrottlingLimitExceeded-*"
```

#### 3. **查看告警**
```bash
aws cloudwatch describe-alarms --alarm-names "ThrottlingLimitExceeded-*"
```

### 🚨 告警配置详解

#### Threshold: 0 的含义
```yaml
Threshold: 0
Statistic: SampleCount
```
- **含义**: 当60秒内发生任何限流事件时触发告警
- **逻辑**: 任何非零的限流事件都表示API限流被触发
- **适用性**: 适用于所有Tier等级，因为任何限流都值得关注

#### 当前实际实现的告警

当前代码库在 `server/services/tenant-api/template.yaml` 中只定义了**单个、按租户**的
限流告警,**没有**按 tier 区分的告警:

```yaml
ThrottlingLimitExceeded:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmDescription: Throttling limit exceeded errors
    ComparisonOperator: GreaterThanThreshold
    EvaluationPeriods: 1
    MetricName: !Join ['-', ["ThrottlingLimitExceeded", !Ref TenantIdParameter]]
    Namespace: "Serverless-SaaS-Reference-Architecture"
    Period: 60
    Statistic: SampleCount
    Threshold: 0
```

#### 分层预警策略(设想 —— 尚未实现)

> 以下为**示意性设计**,并不在当前模板中。一个自然的扩展是为每个 tier 设置各自的
> 阈值与评估窗口,从而对较低等级实施更严格的监控:

```yaml
# Basic Tier - 严格监控
BasicTierThrottlingAlarm:
  Threshold: 0
  EvaluationPeriods: 1

# Standard Tier - 中等监控  
StandardTierThrottlingAlarm:
  Threshold: 5
  EvaluationPeriods: 2

# Premium Tier - 宽松监控
PremiumTierThrottlingAlarm:
  Threshold: 10
  EvaluationPeriods: 3

# Platinum Tier - 最小监控
PlatinumTierThrottlingAlarm:
  Threshold: 20
  EvaluationPeriods: 5
```

#### Statistic: SampleCount 含义
- **定义**: 统计指定时间段内事件的发生次数
- **Period: 60**: 60秒为一个统计周期
- **实际含义**: 统计60秒内限流事件的发生次数
- **告警触发**: 当60秒内限流事件次数 > Threshold 时触发

### 🔗 与其他监控组件的关联

| 组件 | 关联方式 | 作用 |
|------|----------|------|
| **API Gateway** | 访问日志 | 提供限流事件数据源 |
| **CloudWatch Logs** | Metric Filter | 将日志转换为指标 |
| **CloudWatch Metrics** | 指标存储 | 存储限流统计数据 |
| **CloudWatch Alarms** | 告警触发 | 基于指标触发告警 |
| **SNS Topics** | 通知分发 | 发送告警通知 |

### 📈 监控价值

#### 1. **业务洞察**
- 识别API使用模式
- 发现性能瓶颈
- 优化资源分配

#### 2. **运维保障**
- 及时发现限流问题
- 快速响应异常情况
- 保障服务质量

#### 3. **成本控制**
- 监控API使用量
- 优化限流策略
- 控制运营成本

#### 4. **用户体验**
- 减少服务中断
- 提高响应速度
- 保障服务可用性

这种基于CloudWatch Logs Metric Filter的限流监控机制确保了多租户SaaS平台的稳定性和可靠性，为不同等级的客户提供差异化的服务质量保障。

---

[← 返回 README](../../README.zh-CN.md)
