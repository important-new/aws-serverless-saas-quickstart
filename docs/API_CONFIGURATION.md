[**English**](API_CONFIGURATION.md) ｜ [中文](zh-CN/API_CONFIGURATION.md)

[← Back to README](../README.md)

---

## Analysis of Admin Interface Configuration Relationships (Using the Create Tenant Admin User Interface as an Example)

### 📋 Interface Overview

The `Create Tenant Admin User` interface is a key component of the tenant registration flow, responsible for creating an administrator user for each new tenant. The interface uses AWS SigV4 signature authentication to ensure that only authorized system components can invoke it.

### 🔧 Detailed Configuration Relationships

#### 1. API Gateway Endpoint Definition

**Configuration file**: `server/shared/nested_templates/apigateway.yaml`

```yaml
/user/tenant-admin:
  post:
    summary: Creates a tenant admin user
    description: Creates a tenant admin user
    produces:
      - application/json
    responses: {}
    security:
      - sigv4Reference: []  # Uses AWS SigV4 signature authentication
    x-amazon-apigateway-integration:
      uri: !Join
        - ''
        - - !Sub arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/
          - !Ref CreateTenantAdminUserFunctionArn
          - /invocations
      httpMethod: POST
      type: aws_proxy
```

**Key configuration**:
- **URI path**: `/user/tenant-admin`
- **HTTP method**: `POST`
- **Authentication method**: `sigv4Reference` (AWS SigV4 signature)
- **Integration type**: `aws_proxy` (Lambda proxy integration)

#### 2. Lambda Function Definition

**Configuration file**: `server/shared/nested_templates/lambdafunctions.yaml`

```yaml
CreateTenantAdminUserFunction:
  Type: AWS::Serverless::Function
  DependsOn: CreateUserLambdaExecutionRole
  Properties:
    CodeUri: ../TenantManagementService/
    Handler: user-management.create_tenant_admin_user
    Runtime: python3.13
    Role: !GetAtt CreateUserLambdaExecutionRole.Arn
    Tracing: Active
    Layers:
      - !Ref ServerlessSaaSLayers
    Environment:
      Variables:
        TENANT_USER_POOL_ID: !Ref CognitoUserPoolId
        TENANT_APP_CLIENT_ID: !Ref CognitoUserPoolClientId
        TENANT_USER_POOL_CALLBACK_URL: !Join ["",["https://",!Ref TenantUserPoolCallbackURLParameter, "/"]]
        POWERTOOLS_SERVICE_NAME: "UserManagement.CreateTenantAdmin"
```

**Key configuration**:
- **Function name**: `CreateTenantAdminUserFunction`
- **Code path**: `../TenantManagementService/`
- **Handler function**: `user-management.create_tenant_admin_user`
- **Runtime**: `python3.13`
- **IAM role**: `CreateUserLambdaExecutionRole`

#### 3. Lambda Permission Configuration

**Configuration file**: `server/shared/nested_templates/apigateway_lambdapermissions.yaml`

```yaml
CreateTenantAdminUserLambdaApiGatewayExecutionPermission:
  Type: AWS::Lambda::Permission
  Properties:
    Action: lambda:InvokeFunction
    FunctionName: !Ref CreateTenantAdminUserFunctionArn
    Principal: apigateway.amazonaws.com
    SourceArn: !Join ["", ["arn:aws:execute-api:", !Ref "AWS::Region", ":", !Ref "AWS::AccountId", ":", !Ref AdminApiGatewayApi, "/*/*/*" ]]
```

**Key configuration**:
- **Permission type**: `AWS::Lambda::Permission`
- **Allowed action**: `lambda:InvokeFunction`
- **Principal**: `apigateway.amazonaws.com`
- **Source ARN**: The full ARN of the API Gateway

#### 4. Resource Policy Restriction

**Configuration file**: `server/shared/nested_templates/apigateway.yaml`

```yaml
- Effect: Deny
  Principal: "*"
  Action: "execute-api:Invoke"
  Resource: 
    - !Join [ "", [
         "execute-api:/", !Ref StageName, "/POST/user/tenant-admin"
       ]
     ]
  Condition:
    StringNotEquals:
      aws:PrincipalArn:
        - !Ref RegisterTenantLambdaExecutionRoleArn 
        - !Ref TenantManagementLambdaExecutionRoleArn
```

**Key configuration**:
- **Deny policy**: Denies all access by default
- **Exception condition**: Only specific IAM roles can access
- **Resource path**: `execute-api:/{stage}/POST/user/tenant-admin`

#### 5. Environment Variable Configuration

**Configuration file**: `server/shared/nested_templates/lambdafunctions.yaml`

```yaml
Environment:
  Variables:
    CREATE_TENANT_ADMIN_USER_RESOURCE_PATH: "/user/tenant-admin"
```

This environment variable is used during the tenant registration process to build the API call URL.

### 📊 Configuration Relationship Summary

| Component | Configuration File | Key Configuration | Purpose |
|------|----------|----------|------|
| **API endpoint** | `apigateway.yaml` | `/user/tenant-admin` POST | Defines the HTTP interface |
| **Lambda function** | `lambdafunctions.yaml` | `CreateTenantAdminUserFunction` | Handles business logic |
| **Permission control** | `apigateway_lambdapermissions.yaml` | `CreateTenantAdminUserLambdaApiGatewayExecutionPermission` | Allows API Gateway to invoke Lambda |
| **Access control** | `apigateway.yaml` | Resource policy | Restricts access to specific roles only |
| **Environment variable** | `lambdafunctions.yaml` | `CREATE_TENANT_ADMIN_USER_RESOURCE_PATH` | Provides the API path for other functions to use |

### 🔄 Invocation Flow

1. **Client request** → `POST /user/tenant-admin`
2. **API Gateway** → Validates the AWS SigV4 signature
3. **Resource policy** → Checks the caller's IAM role permissions
4. **Lambda permission** → Validates the API Gateway invocation permission
5. **Lambda function** → Executes `user-management.create_tenant_admin_user`
6. **Response returned** → Returned to the client via API Gateway

### 🛡️ Security Features

- **AWS SigV4 signature authentication**: Ensures the legitimacy of the request source
- **IAM role restriction**: Only specific roles can call the interface
- **Resource policy**: Fine-grained access control
- **Lambda permission**: Principle of least privilege

### 🔗 Associations with Other Components

- **Tenant registration flow**: Automatically invoked during the tenant registration process
- **User management service**: The core logic for creating tenant admin users
- **Cognito integration**: Creates users in the corresponding user pool
- **Permission management**: Assigns appropriate permissions to tenant admins

This configuration ensures the interface's security, traceability, and correct permission control, and is an important part of user management in the overall multi-tenant SaaS architecture.

## Analysis of Tenant Business Interface Configuration Relationships (Using the GetOrdersFunction Interface as an Example)

### 📋 Interface Overview

The `GetOrdersFunction` interface is a core component of the tenant business application, responsible for retrieving all order data for a specified tenant. The interface adopts a multi-tenant architecture design, supports both pooled and silo deployment models, and integrates API key authentication and a Lambda authorizer.

### 🔧 Detailed Configuration Relationships

#### 1. Tenant API Gateway Configuration

**Configuration file**: `server/tenant-template.yaml`

```yaml
ApiGatewayTenantApi:
  Type: AWS::Serverless::Api
  Properties:
    MethodSettings:
      - DataTraceEnabled: False
        LoggingLevel: INFO
        MetricsEnabled: True
        ResourcePath: '/*' 
        HttpMethod: '*' 
    AccessLogSetting:
      DestinationArn: !GetAtt ApiGatewayAccessLogs.Arn
      Format: '{ "requestId":"$context.requestId", "ip": "$context.identity.sourceIp", "caller":"$context.identity.caller", "user":"$context.identity.user","requestTime":"$context.requestTime", "httpMethod":"$context.httpMethod","resourcePath":"$context.resourcePath", "status":"$context.status","protocol":"$context.protocol", "responseLength":"$context.responseLength" }'
    TracingEnabled: True
    DefinitionBody:
      openapi: 3.0.1
      info:
        title: !Join ['-', [!Ref TenantIdParameter, 'serverless-saas-tenant-api']]
      basePath: !Join ['', ['/', !Ref StageName]]
      x-amazon-apigateway-api-key-source : "AUTHORIZER"
      schemes:
        - https
      paths:
        /orders:
          get:
            summary: Returns all orders
            description: Returns all orders.
            produces:
              - application/json
            responses: {}
            security:   
              - api_key: []  # API key authentication
              - Authorizer: []  # Lambda authorizer
            x-amazon-apigateway-integration:
              uri: !Join
                - ''
                - - !Sub arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/
                  - !GetAtt GetOrdersFunction.Arn
                  - /invocations
              httpMethod: POST
              type: aws_proxy
```

**Key configuration**:
- **API name**: Dynamically named to include the tenant ID
- **API key source**: `AUTHORIZER` (requires authorizer validation)
- **Access logging**: Detailed request logging
- **X-Ray tracing**: Distributed tracing enabled
- **URI path**: `/orders`
- **HTTP method**: `GET`
- **Authentication method**: `api_key` + `Authorizer` (dual authentication)

#### 2. Lambda Function Definition

**Configuration file**: `server/tenant-template.yaml`

```yaml
GetOrdersFunction:
  Type: AWS::Serverless::Function 
  DependsOn: OrderFunctionExecutionRole 
  Properties:
    CodeUri: OrderService/
    Handler: order_service.get_orders
    Tracing: Active
    Role: !GetAtt OrderFunctionExecutionRole.Arn
    ReservedConcurrentExecutions: !If [IsPooledDeploy, !Ref "AWS::NoValue" , !Ref "AWS::NoValue"]
    Layers: 
      - !Ref ServerlessSaaSLayers
    Environment:
      Variables:
        POWERTOOLS_SERVICE_NAME: "OrderService"
        IS_POOLED_DEPLOY: !If [IsPooledDeploy, true, false]
        ORDER_TABLE_NAME: !Ref OrderTable
    Tags:
      TenantId: !Ref TenantIdParameter
```

**Key configuration**:
- **Function name**: `GetOrdersFunction`
- **Code path**: `OrderService/`
- **Handler function**: `order_service.get_orders`
- **Runtime**: `python3.13` (global configuration)
- **IAM role**: `OrderFunctionExecutionRole`
- **Concurrency control**: Conditional configuration based on the deployment model

#### 3. Lambda Permission Configuration

**Configuration file**: `server/tenant-template.yaml`

```yaml
GetOrdersLambdaApiGatewayExecutionPermission:
  Type: AWS::Lambda::Permission
  Properties:
    Action: lambda:InvokeFunction
    FunctionName: !GetAtt 
      - GetOrdersFunction
      - Arn
    Principal: apigateway.amazonaws.com
    SourceArn: !Join [
      "", [
        "arn:aws:execute-api:", 
        {"Ref": "AWS::Region"}, ":", 
        {"Ref": "AWS::AccountId"}, ":", 
        !Ref ApiGatewayTenantApi, "/*/*/*"
        ]
      ]
```

**Key configuration**:
- **Permission type**: `AWS::Lambda::Permission`
- **Allowed action**: `lambda:InvokeFunction`
- **Principal**: `apigateway.amazonaws.com`
- **Source ARN**: The full ARN of the tenant API Gateway

#### 4. IAM Role and Policy

**Configuration file**: `server/tenant-template.yaml`

```yaml
OrderFunctionExecutionRole:
  Type: AWS::IAM::Role     
  Properties:
    RoleName: !Join ['-', [!Ref TenantIdParameter, order-function-execution-role]]
    Path: '/'
    AssumeRolePolicyDocument:
      Version: 2012-10-17
      Statement:
        - Effect: Allow
          Principal:
            Service:
              - lambda.amazonaws.com
          Action:
            - sts:AssumeRole
    ManagedPolicyArns: 
      - arn:aws:iam::aws:policy/CloudWatchLambdaInsightsExecutionRolePolicy    
      - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
      - arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess

OrderFunctionExecutionRolePolicy:
  Condition: IsSiloDeploy
  Type: AWS::IAM::Policy
  Properties:
    PolicyName: !Join ['-', [!Ref TenantIdParameter, order-function-policy]]
    Roles: 
      - !Ref OrderFunctionExecutionRole
    PolicyDocument:
      Version: 2012-10-17
      Statement:              
        - Effect: Allow
          Action:
            - dynamodb:GetItem
            - dynamodb:UpdateItem
            - dynamodb:PutItem
            - dynamodb:DeleteItem
            - dynamodb:Query
          Resource:
            - !GetAtt OrderTable.Arn
```

**Key configuration**:
- **Role name**: Dynamically named to include the tenant ID
- **Managed policies**: CloudWatch, Lambda basic execution, and X-Ray write permissions
- **Custom policy**: Created only in dedicated deployment mode, providing DynamoDB access

#### 5. Data Storage Configuration

**Configuration file**: `server/services/order-service/template.yaml`

```yaml
OrderTable:
  Type: AWS::DynamoDB::Table
  Properties: 
    AttributeDefinitions:
      - AttributeName: tenant_id
        AttributeType: S 
      - AttributeName: order_id
        AttributeType: S          
    KeySchema:
      - AttributeName: tenant_id
        KeyType: HASH 
      - AttributeName: order_id
        KeyType: RANGE  
    ProvisionedThroughput: 
      ReadCapacityUnits: 5
      WriteCapacityUnits: 5
    TableName: !Join ['-', [Order, !Ref TenantIdParameter]]
    Tags:
      - Key: "TenantId"
        Value: !Ref TenantIdParameter
```

**Key configuration**:
- **Table name**: Dynamically named to include the tenant ID (`Order-{tenantId}`)
- **Partition key**: `tenant_id` (used for multi-tenant data isolation)
- **Sort key**: `order_id` (unique order identifier)
- **Tags**: Include the tenant ID for resource management

### 📊 Configuration Relationship Summary

| Component | Configuration File | Key Configuration | Purpose |
|------|----------|----------|------|
| **Tenant API Gateway** | `tenant-template.yaml` | `ApiGatewayTenantApi` | Creates a tenant-dedicated API gateway |
| **API endpoint definition** | `tenant-template.yaml` | `DefinitionBody.paths` | Defines the specific API routes |
| **Lambda function** | `tenant-template.yaml` | `GetOrdersFunction` | Handles business logic |
| **Permission control** | `tenant-template.yaml` | `GetOrdersLambdaApiGatewayExecutionPermission` | API Gateway invocation permission |
| **IAM role** | `tenant-template.yaml` | `OrderFunctionExecutionRole` | Lambda execution permissions |
| **Data storage** | `tenant-template.yaml` | `OrderTable` | Order data storage |

### 🔄 Invocation Flow

1. **Client request** → `GET /orders`
2. **API Gateway** → Validates the API key
3. **Lambda authorizer** → Validates user identity and tenant permissions
4. **Lambda permission** → Validates the API Gateway invocation permission
5. **Lambda function** → Executes `order_service.get_orders`
6. **DynamoDB query** → Queries order data by tenant ID
7. **Response returned** → Returned to the client via API Gateway

### 🛡️ Security Features

- **API key authentication**: Ensures the legitimacy of the request source
- **Lambda authorizer**: Validates user identity and tenant permissions
- **IAM role restriction**: Principle of least privilege
- **Multi-tenant data isolation**: Achieves data isolation via the partition key
- **Resource tags**: Facilitate resource management and cost allocation

### 🔗 Multi-tenant Features

- **Dynamic resource naming**: All resource names include the tenant ID
- **Conditional deployment**: Adjusts configuration based on tenant type (pooled/dedicated)
- **Data isolation**: Achieves tenant data isolation via the DynamoDB partition key
- **Independent API Gateway**: Each tenant has an independent API Gateway instance

### 🎯 Comparison with the Admin Interface

| Feature | Admin Interface | Tenant Interface |
|------|-----------|----------|
| **API Gateway** | Shared management API | Tenant-dedicated API |
| **Authentication method** | AWS SigV4 signature | API key + Lambda authorizer |
| **Access control** | IAM role restriction | Tenant-level permission control |
| **Data scope** | Global management | Tenant-isolated data |
| **Deployment model** | Shared resources | Dynamic tenant resources |

This configuration ensures complete isolation of tenant data while providing flexible deployment models and strong security controls, making it a typical implementation of business services in a multi-tenant SaaS architecture.

---

[← Back to README](../README.md)
