[**English**](THROTTLING_AND_MONITORING.md) ｜ [中文](zh-CN/THROTTLING_AND_MONITORING.md)

[← Back to README](../README.md)

---

## Monitoring and Operations

### Logging
- All Lambda functions integrate structured logging
- Tenant context information is recorded automatically
- Centralized management via CloudWatch Logs

### Performance Monitoring
- X-Ray distributed tracing
- CloudWatch metric monitoring
- API Gateway access logs

### Alarm Configuration
- API throttling alarms
- Error rate monitoring
- Performance threshold alarms

### API Throttling and Usage Plan Management

#### UpdateUsagePlanFunction Analysis

**Primary purpose**: `UpdateUsagePlanFunction` is a custom-resource Lambda function used to **associate a tenant's API Gateway with the corresponding Usage Plan**, implementing tier-based API throttling and quota control.

#### 🔄 Core Functionality

**Dynamically associating usage plans**:
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

**Association strategy based on deployment model**:

**Pooled Deploy**:
```python
if(is_pooled_deploy == "true"):
    # Pooled tenants share usage plans of all tiers
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
    # Likewise associate the Standard and Premium tiers
```

**Silo Deploy**:
```python
else:
    # Dedicated tenants associate only with the Platinum-tier usage plan
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

#### 🎯 Usage Plan Tier Configuration

**Basic Tier**:
```yaml
UsagePlanBasicTier:
  Properties:
    Quota:
      Limit: 500        # 500 requests per day
      Period: DAY
    Throttle:
      BurstLimit: 50    # Burst limit of 50
      RateLimit: 50     # 50 per second
```

**Standard Tier**:
```yaml
UsagePlanStandardTier:
  Properties:
    Quota:
      Limit: 3000       # 3000 requests per day
      Period: DAY
    Throttle:
      BurstLimit: 100   # Burst limit of 100
      RateLimit: 75     # 75 per second
```

**Premium Tier**:
```yaml
UsagePlanPremiumTier:
  Properties:
    Quota:
      Limit: 5000       # 5000 requests per day
      Period: DAY
    Throttle:
      BurstLimit: 200   # Burst limit of 200
      RateLimit: 100    # 100 per second
```

**Platinum Tier**:
```yaml
UsagePlanPlatinumTier:
  Properties:
    Quota:
      Limit: 10000      # 10000 requests per day
      Period: DAY
    Throttle:
      BurstLimit: 300   # Burst limit of 300
      RateLimit: 300    # 300 per second
```

#### 🔄 Execution Flow

**CloudFormation custom resource**:
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

**Lambda function execution**:
- **On create**: Executes the `do_action` function to associate usage plans
- **On update**: Executes the `do_nothing` function, taking no action
- **On delete**: Executes the `do_nothing` function, taking no action

#### 🛡️ Permission Configuration

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

#### 🎯 Business Value

**Multi-tenant API throttling**:
- **Pooled tenants**: Share infrastructure and control API access frequency through usage plans
- **Dedicated tenants**: Have independent infrastructure and enjoy the highest-tier usage plan

**Service tier differentiation**:
- **Basic**: Suitable for small businesses, with stricter limits
- **Standard**: Suitable for medium businesses, balancing performance and cost
- **Premium**: Suitable for large businesses, with higher performance
- **Platinum**: Suitable for enterprise customers, with the highest performance

**Cost control**:
- Prevents resource abuse through API throttling
- Bills based on usage
- Supports burst-traffic handling

**Monitoring and alarms**:
```yaml
ThrottlingLimitExceeded:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmDescription: Throttling limit exceeded errors
    MetricName: !Join ['-', ["ThrottlingLimitExceeded", !Ref TenantIdParameter]]
    Namespace: "Serverless-SaaS-Reference-Architecture"
```

#### 🔗 Associations with Other Components

| Component | Association Method | Purpose |
|------|----------|------|
| **API Gateway** | Associated via API ID | Applies throttling policies to the tenant API |
| **Usage Plan** | Associated via Usage Plan ID | Defines throttling and quota rules |
| **CloudWatch** | Monitoring alarms | Monitors throttling events |
| **DynamoDB** | Configuration storage | Stores tenant configuration information |

#### 📈 Summary

`UpdateUsagePlanFunction` is a key component in the multi-tenant SaaS architecture. It implements:

1. **Dynamic throttling**: Automatically applies different API throttling policies based on tenant tier
2. **Service differentiation**: Achieves service-tier differentiation through usage plans
3. **Resource protection**: Prevents API abuse and protects system resources
4. **Cost optimization**: Provides precise, usage-based cost control
5. **Monitoring and alarms**: Provides a complete throttling monitoring and alarm mechanism

This design ensures that the multi-tenant SaaS platform can provide a differentiated service experience for customers of different tiers while protecting system resources from abuse.

## API Throttling Monitoring Mechanism

### 🎯 ThrottlingLimitExceeded Metric Definition

#### 📍 Definition Location

**File**: `server/tenant-template.yaml`  
**Lines**: 375-384

#### 🔧 Metric Filter Configuration

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

### 🔄 How It Works

#### 1. **Data Source**
```yaml
LogGroupName: 
  Ref: "ApiGatewayAccessLogs"
```
- **Source**: API Gateway access logs
- **Log group**: `/aws/api-gateway/access-logs-serverless-saas-tenant-api-{tenantId}`

#### 2. **Filter Pattern**
```yaml
FilterPattern: '{$.status = "429"}'
```
- **Purpose**: Filters log entries with HTTP status code 429
- **Meaning**: 429 = "Too Many Requests" (throttling response)

#### 3. **Metric Transformation**
```yaml
MetricTransformations:
  - 
    MetricValue: "1"                                    # Each throttling event counts as 1
    MetricNamespace: "Serverless-SaaS-Reference-Architecture"  # Metric namespace
    MetricName: !Join ['-', ["ThrottlingLimitExceeded", !Ref TenantIdParameter]]  # Metric name
```

### 🔄 Complete Flow

#### 1. **API Gateway Access Log**
```json
{
  "requestId": "abc123",
  "ip": "192.168.1.1",
  "status": "429",  // Throttling response
  "httpMethod": "GET",
  "resourcePath": "/orders",
  "responseLength": "0"
}
```

#### 2. **Metric Filter Processing**
```
Log entry → FilterPattern match → Generate metric
{$.status = "429"} → Match succeeds → ThrottlingLimitExceeded-{tenantId} = 1
```

#### 3. **CloudWatch Metric**
```
Metric name: ThrottlingLimitExceeded-{tenantId}
Namespace: Serverless-SaaS-Reference-Architecture
Value: 1 (per throttling event)
```

#### 4. **Alarm Trigger**
```yaml
ThrottlingLimitExceeded:
  Type: AWS::CloudWatch::Alarm
  Properties:
    MetricName: !Join ['-', ["ThrottlingLimitExceeded", !Ref TenantIdParameter]]
    Namespace: "Serverless-SaaS-Reference-Architecture"
    Threshold: 0
    Statistic: SampleCount  # Counts the number of events within 60 seconds
```

### 🔧 Key Component Associations

#### 1. **API Gateway Configuration**
```yaml
ApiGatewayTenantApi:
  Properties:
    AccessLogSetting:
      DestinationArn: !GetAtt ApiGatewayAccessLogs.Arn
      Format: '{ "requestId":"$context.requestId", "ip": "$context.identity.sourceIp", "caller":"$context.identity.caller", "user":"$context.identity.user","requestTime":"$context.requestTime", "httpMethod":"$context.httpMethod","resourcePath":"$context.resourcePath", "status":"$context.status","protocol":"$context.protocol", "responseLength":"$context.responseLength" }'
```

#### 2. **Log Group**
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

### 🎯 Design Advantages

#### 1. **Automated Monitoring**
- No need to write code manually
- Metrics are generated automatically from logs
- Real-time monitoring of throttling events

#### 2. **Tenant Isolation**
- Each tenant has an independent metric name
- Facilitates isolated monitoring and alarming
- Supports tenant-level analysis

#### 3. **Cost-effectiveness**
- Leverages existing access logs
- No additional monitoring code required
- Efficient log filtering mechanism

#### 4. **Scalability**
- Easy to add new filter conditions
- Supports complex log pattern matching
- Extensible to other types of monitoring

### 📊 Monitoring Results

#### 1. **Real-time**
- Processed immediately after logs are produced
- Metrics updated in real time
- Alarms triggered quickly

#### 2. **Accuracy**
- Based on actual HTTP response status
- Filter conditions match precisely
- Avoids false positives and false negatives

#### 3. **Traceability**
- Retains complete access logs
- Supports historical data analysis
- Facilitates problem diagnosis

### 🔍 Verification Methods

#### 1. **View Log Groups**
```bash
aws logs describe-log-groups --log-group-name-prefix "/aws/api-gateway/access-logs-serverless-saas-tenant-api-"
```

#### 2. **View Metrics**
```bash
aws cloudwatch list-metrics --namespace "Serverless-SaaS-Reference-Architecture" --metric-name "ThrottlingLimitExceeded-*"
```

#### 3. **View Alarms**
```bash
aws cloudwatch describe-alarms --alarm-names "ThrottlingLimitExceeded-*"
```

### 🚨 Detailed Alarm Configuration

#### Meaning of Threshold: 0
```yaml
Threshold: 0
Statistic: SampleCount
```
- **Meaning**: Triggers an alarm when any throttling event occurs within 60 seconds
- **Logic**: Any non-zero throttling event indicates that API throttling has been triggered
- **Applicability**: Applies to all tiers, because any throttling is worth attention

#### Currently Implemented Alarm

The codebase currently defines a **single, per-tenant** throttling alarm in
`server/services/tenant-api/template.yaml` — there is no tier-specific alarm:

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

#### Tiered Alerting Strategy (proposed — not yet implemented)

> The following is an **illustrative design**, not part of the current
> templates. A natural extension is to give each tier its own threshold and
> evaluation window so that lower tiers are watched more strictly:

```yaml
# Basic Tier - Strict monitoring
BasicTierThrottlingAlarm:
  Threshold: 0
  EvaluationPeriods: 1

# Standard Tier - Moderate monitoring  
StandardTierThrottlingAlarm:
  Threshold: 5
  EvaluationPeriods: 2

# Premium Tier - Relaxed monitoring
PremiumTierThrottlingAlarm:
  Threshold: 10
  EvaluationPeriods: 3

# Platinum Tier - Minimal monitoring
PlatinumTierThrottlingAlarm:
  Threshold: 20
  EvaluationPeriods: 5
```

#### Meaning of Statistic: SampleCount
- **Definition**: Counts the number of events within a specified time period
- **Period: 60**: 60 seconds is one statistical period
- **Actual meaning**: Counts the number of throttling events within 60 seconds
- **Alarm trigger**: Triggers when the number of throttling events within 60 seconds > Threshold

### 🔗 Associations with Other Monitoring Components

| Component | Association Method | Purpose |
|------|----------|------|
| **API Gateway** | Access logs | Provides the throttling event data source |
| **CloudWatch Logs** | Metric Filter | Converts logs into metrics |
| **CloudWatch Metrics** | Metric storage | Stores throttling statistics |
| **CloudWatch Alarms** | Alarm trigger | Triggers alarms based on metrics |
| **SNS Topics** | Notification distribution | Sends alarm notifications |

### 📈 Monitoring Value

#### 1. **Business Insights**
- Identify API usage patterns
- Discover performance bottlenecks
- Optimize resource allocation

#### 2. **Operational Assurance**
- Detect throttling issues promptly
- Respond quickly to anomalies
- Ensure service quality

#### 3. **Cost Control**
- Monitor API usage
- Optimize throttling policies
- Control operational costs

#### 4. **User Experience**
- Reduce service disruptions
- Improve response speed
- Ensure service availability

This CloudWatch Logs Metric Filter-based throttling monitoring mechanism ensures the stability and reliability of the multi-tenant SaaS platform, providing differentiated service-quality guarantees for customers of different tiers.

---

[← Back to README](../README.md)
