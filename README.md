# AWS Serverless SaaS Quick Start

[**English**](README.md) ｜ [中文](README.zh-CN.md)

## Project Overview

This is a reference architecture for a multi-tenant SaaS application built on the AWS serverless technology stack. The project demonstrates how to implement a scalable, secure, and cost-effective SaaS solution on the AWS cloud platform, supporting multiple tenant isolation models (pooled and silo).

## About This Project and Upstream

This project is derived from the official AWS [AWS Serverless SaaS Workshop](https://github.com/aws-samples/aws-serverless-saas-workshop) (based on its `Lab6`), and builds on it with extensive changes including **backend architecture refactoring, data model simplification, runtime and dependency upgrades, and deployment script enhancements**. It now evolves as an independent derivative project under MIT-0.

- Full list of differences and their rationale: [`docs/CHANGES_FROM_WORKSHOP.md`](docs/CHANGES_FROM_WORKSHOP.md)
- Copyright provenance and attribution: [`NOTICE`](NOTICE) ｜ License: [`LICENSE`](LICENSE) (MIT-0)

## Core Features

- **Multi-tenant architecture**: Supports both pooled and silo tenant isolation models
- **Tiered services**: Supports four service tiers — Basic, Standard, Premium, and Platinum
- **Serverless architecture**: Built on serverless services such as AWS Lambda, API Gateway, and DynamoDB
- **Identity authentication**: Integrates AWS Cognito for user identity management
- **API throttling**: Tier-based API usage control
- **Monitoring and logging**: Integrates CloudWatch and X-Ray for application monitoring
- **Automated deployment**: Uses AWS SAM and CDK for infrastructure as code

## Technical Architecture

### Backend Services (server/)
- **AWS Lambda**: Serverless compute service
- **API Gateway**: RESTful API management and routing
- **DynamoDB**: NoSQL database storage
- **AWS Cognito**: User identity authentication and authorization
- **CloudFormation/SAM**: Infrastructure as code
- **Python 3.13**: Backend development language
- **PyJWT[crypto]**: Cognito JWT validation (replaces the unmaintained `python-jose`, avoiding CVE-2024-33663/33664)

### Database Design Rules

#### DynamoDB Table Design Principles

Based on AWS's officially recommended best practices, this project adopts a simplified partition-key design and removes the complex sharding strategy to improve performance and reduce cost.

##### Core Design Principles

1. **Even distribution**: Use the tenant ID as the partition key to ensure data is evenly distributed
2. **Hot-spot avoidance**: Each tenant has its own partition, avoiding hot-spot issues
3. **Predictable access**: Tenant-based access patterns are more predictable
4. **Simplified queries**: No need for complex parallel query logic

##### Standard Table Structure

```python
# Unified data model design
{
    "tenant_id": "tenant1",           # Partition key (HASH)
    "entity_id": "uuid-123",         # Sort key (RANGE)
    "entity_type": "PRODUCT",        # Entity type identifier
    "created_at": "2024-01-01T00:00:00Z",  # Creation time
    "updated_at": "2024-01-01T00:00:00Z",  # Update time
    # ... business fields
}
```

##### CloudFormation Table Definition

```yaml
# Standard table structure template
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

##### Query Strategy

```python
# Standard query pattern
response = table.query(
    KeyConditionExpression=Key('tenant_id').eq(tenant_id),
    ReturnConsumedCapacity='TOTAL'
)
```

##### Performance Optimization Considerations

- **Small data volumes** (< 1000 entities/tenant): Simple queries are sufficient
- **Large data volumes** (> 1000 entities/tenant): Consider adding a GSI
- **Cost-sensitive**: The current design minimizes storage cost

##### Data Migration Strategy

1. **Back up existing data**
2. **Run the migration script**
3. **Validate the migration result**
4. **Update the application code**
5. **Delete the old data**

##### Monitoring Metrics

- Query latency
- Throughput
- Error rate
- Cost

##### Refactoring Benefits

✅ **Minimal design** - The fewest fields and indexes  
✅ **Cost optimization** - Reduced storage and write overhead  
✅ **Performance improvement** - Simplified query logic  
✅ **Easy to maintain** - Reduced code complexity  
✅ **Scalability** - Room reserved for future growth

### Frontend Application (client/)
- **Angular 20**: Modern web application framework (standalone components, Material M3 theming)
- **TypeScript 5.8**: Type-safe JavaScript
- **Angular Material**: UI component library
- **AWS Amplify v6** + **@aws-amplify/ui-angular 5**: Frontend integration with AWS services (authentication UI)

## Project Structure

```
Lab6/
├── server/                          # Backend services
│   ├── shared-template.yaml         # Shared resources CloudFormation template
│   ├── tenant-template.yaml         # Tenant resources CloudFormation template
│   ├── ProductService/              # Product management service
│   ├── OrderService/                # Order management service
│   ├── TenantManagementService/     # Tenant management service
│   ├── Auth/                        # Authorizer and shared resources
│   ├── layers/                      # Lambda layer dependencies
│   ├── nested_templates/            # Nested CloudFormation templates
│   ├── custom_resources/            # Custom resources
│   └── TenantPipeline/              # Tenant deployment pipeline (CDK)
├── client/                          # Frontend application
│   ├── Admin/                       # System administrator interface
│   ├── Application/                 # Tenant application interface
│   └── Landing/                     # Landing page
└── scripts/                         # Deployment and test scripts
```

## Core Services

### 1. Product Service (ProductService)
- CRUD operations for products
- Supports multi-tenant data isolation
- Integrates monitoring and logging

### 2. Order Service (OrderService)
- CRUD operations for orders
- Order-product association management
- Tenant-level data access control

### 3. Tenant Management Service (TenantManagementService)
- Tenant registration and configuration
- Tenant activation/deactivation
- User management and permission control
- Tenant resource provisioning

### 4. Frontend Application
- **Admin**: System administrator console for managing tenants and users
- **Application**: Tenant business application for managing products and orders
- **Landing**: Tenant registration and login page

## Platform Tenant Management Implementation

### 🏗️ Core Architecture

#### Data Storage Layer
```yaml
# Four core DynamoDB tables
- ServerlessSaaS-TenantDetails      # Basic tenant information
- ServerlessSaaS-TenantStackMapping # Tenant-to-infrastructure mapping
- ServerlessSaaS-TenantUserMapping  # Tenant-user mapping
- ServerlessSaaS-Settings           # System configuration
```

#### Service Layer
- **Tenant registration service** (`tenant-registration.py`)
- **Tenant provisioning service** (`tenant-provisioning.py`) 
- **Tenant management service** (`tenant-management.py`)
- **User management service** (`user-management.py`)

### 🔄 Tenant Lifecycle Management

#### Tenant Registration Flow
```python
def register_tenant(event, context):
    # 1. Generate tenant ID and API key
    tenant_id = uuid.uuid1().hex
    api_key = get_api_key_by_tier(tenant_tier)
    
    # 2. Create the tenant admin user
    create_user_response = __create_tenant_admin_user(tenant_details)
    
    # 3. Create the tenant record
    create_tenant_response = __create_tenant(tenant_details)
    
    # 4. Dedicated tenants need infrastructure provisioning
    if dedicatedTenancy == 'TRUE':
        provision_tenant_response = __provision_tenant(tenant_details)
```

#### Tenant Provisioning Mechanism
```python
def provision_tenant(event, context):
    # 1. Record the tenant-to-CloudFormation-stack mapping
    table_tenant_stack_mapping.put_item({
        'tenantId': tenant_id,
        'stackName': f'stack-{tenant_id}',
        'applyLatestRelease': True
    })
    
    # 2. Trigger CodePipeline to deploy dedicated infrastructure
    codepipeline.start_pipeline_execution(
        name='serverless-saas-pipeline'
    )
```

### 👥 User Management Mechanism

#### Multi-tenant User Pool Strategy
- **Pooled tenants**: Shared Cognito user pool
- **Dedicated tenants**: Independent Cognito user pool

#### User Creation Flow
```python
def create_tenant_admin_user(event, context):
    if dedicatedTenancy == 'true':
        # Create a dedicated user pool
        user_pool = create_user_pool(tenant_id)
        app_client = create_user_pool_client(user_pool_id)
    else:
        # Use the shared user pool
        user_pool_id = TENANT_USER_POOL_ID
        
    # Create the tenant group and admin user
    create_user_group(user_pool_id, tenant_id)
    create_tenant_admin(user_pool_id, tenant_admin_user_name)
```

#### Tenant Information Association Mechanism

##### 🔗 Core Association Field

**Tenant ID (tenantId)**:
- **Purpose**: Serves as the unique identifier for all associations
- **Format**: A UUID-format string (e.g., `abc123-def456-ghi789`)
- **Generation**: Generated via `uuid.uuid1().hex` during tenant registration

##### 📊 Association Architecture

**Cognito User Pool ↔ DynamoDB Association**:
```python
# Establishing associations during tenant registration
def create_tenant_admin_user(event, context):
    tenant_details = json.loads(event['body'])
    tenant_id = tenant_details['tenantId']  # Core association field
    
    # 1. Create or select a user pool
    if (tenant_details['dedicatedTenancy'] == 'true'):
        user_pool_response = user_mgmt.create_user_pool(tenant_id)
        user_pool_id = user_pool_response['UserPool']['Id']
    else:
        user_pool_id = tenant_user_pool_id
    
    # 2. Store the tenant configuration in DynamoDB
    tenant_config = {
        'tenantId': tenant_id,
        'userPoolId': user_pool_id,  # Association field
        'appClientId': app_client_id,
        'apiGatewayUrl': api_gateway_url,
        'apiKey': api_key
    }
    
    # 3. Set tenant attributes when creating the user in Cognito
    create_tenant_admin_response = user_mgmt.create_tenant_admin(
        user_pool_id, 
        tenant_admin_user_name, 
        tenant_details
    )
```

**User ↔ Tenant Association**:
```python
# Establishing associations during user creation
def create_user(event, context):
    # 1. Get the current tenant info from the authorizer
    tenant_id = event['requestContext']['authorizer']['tenantId']
    user_pool_id = event['requestContext']['authorizer']['userPoolId']
    
    # 2. Set tenant attributes when creating the user in Cognito
    response = client.admin_create_user(
        Username=user_details['userName'],
        UserPoolId=user_pool_id,
        UserAttributes=[
            {
                'Name': 'custom:tenantId',  # Key association attribute
                'Value': tenant_id
            },
            {
                'Name': 'custom:userRole',
                'Value': user_details['userRole']
            }
        ]
    )
    
    # 3. Create the user-tenant mapping in DynamoDB
    user_mgmt.create_user_tenant_mapping(user_details['userName'], tenant_id)
```

##### 🔍 Association Query Flow

**Querying from Cognito to DynamoDB**:
```python
def get_users(event, context):
    tenant_id = event['requestContext']['authorizer']['tenantId']
    user_pool_id = event['requestContext']['authorizer']['userPoolId']
    
    # 1. Get the user list from Cognito
    response = client.list_users(UserPoolId=user_pool_id)
    
    # 2. Filter users of the same tenant via the custom:tenantId attribute
    for user in response['Users']:
        for attr in user["Attributes"]:
            if(attr["Name"] == "custom:tenantId" and attr["Value"] == tenant_id):
                # Found a user of the same tenant
                user_info = UserInfo()
                user_info.tenant_id = attr["Value"]  # Association field
                user_info.user_name = user["Username"]
                users.append(user_info)
```

**Querying from DynamoDB to Cognito**:
```python
def get_user_info(event, user_pool_id, user_name):
    # 1. Get the user details from Cognito
    response = client.admin_get_user(
        UserPoolId=user_pool_id,
        Username=user_name
    )
    
    # 2. Extract the tenant ID
    user_info = UserInfo()
    for attr in response["UserAttributes"]:
        if(attr["Name"] == "custom:tenantId"):
            user_info.tenant_id = attr["Value"]  # Association field
            break
    
    # 3. The tenant details in DynamoDB can be queried via tenant_id
    tenant_details = table_tenant_details.get_item(
        Key={'tenantId': user_info.tenant_id}
    )
    
    return user_info
```

##### 📋 Data Table Association Structure

**TenantDetails Table**:
```yaml
# Stores tenant configuration information
TenantDetailsTable:
  KeySchema:
    - AttributeName: tenantId  # Primary key
      KeyType: HASH
  Attributes:
    - tenantId: "abc123"       # Association field
    - userPoolId: "us-east-1_xxxxxxxxx"  # Cognito user pool ID
    - appClientId: "xxxxxxxxxxxxxxxxxxxxxxxxxx"
    - apiGatewayUrl: "https://abc123.execute-api.us-east-1.amazonaws.com/prod/"
    - apiKey: "xxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**TenantUserMapping Table**:
```yaml
# Stores the user-tenant mapping relationship
TenantUserMappingTable:
  KeySchema:
    - AttributeName: tenantId   # Partition key
      KeyType: HASH
    - AttributeName: userName   # Sort key
      KeyType: RANGE
  Attributes:
    - tenantId: "abc123"        # Association field
    - userName: "tenant-admin-abc123"
```

**Cognito User Attributes**:
```json
{
  "Username": "tenant-admin-abc123",
  "UserAttributes": [
    {
      "Name": "custom:tenantId",    // Key association attribute
      "Value": "abc123"
    },
    {
      "Name": "custom:userRole",
      "Value": "TenantAdmin"
    },
    {
      "Name": "email",
      "Value": "admin@company.com"
    }
  ]
}
```

##### 🔧 Association Maintenance Mechanism

**Establishing associations during tenant registration**:
```python
def register_tenant(event, context):
    # 1. Generate the tenant ID
    tenant_id = uuid.uuid1().hex
    
    # 2. Create the tenant admin user
    create_user_response = __create_tenant_admin_user(tenant_details)
    
    # 3. Create the tenant record
    create_tenant_response = __create_tenant(tenant_details)
    
    # 4. Dedicated tenants need infrastructure provisioning
    if dedicatedTenancy == 'TRUE':
        provision_tenant_response = __provision_tenant(tenant_details)
```

**Maintaining associations during user creation**:
```python
def create_user_tenant_mapping(self, user_name, tenant_id):
    # Ensure the mapping is established immediately after the user is created
    response = table_tenant_user_map.put_item(
        Item={
            'tenantId': tenant_id,    # Association field
            'userName': user_name
        }
    )
    return response
```

**Validating associations during user queries**:
```python
def get_user(event, context):
    tenant_id = event['requestContext']['authorizer']['tenantId']
    user_name = event['pathParameters']['username']
    
    # 1. Get user info from Cognito
    user_info = get_user_info(event, user_pool_id, user_name)
    
    # 2. Validate the tenant association
    if(not auth_manager.isSystemAdmin(user_role) and user_info.tenant_id != tenant_id):
        return utils.create_unauthorized_response()
```

##### 🛡️ Association Security

**Association validation in the authorizer**:
```python
def lambda_handler(event, context):
    # 1. Extract the tenant ID from the JWT token
    unauthorized_claims = jwt.get_unverified_claims(jwt_bearer_token)
    tenant_id = unauthorized_claims['custom:tenantId']
    
    # 2. Query the tenant details to validate the association
    tenant_details = table_tenant_details.get_item(
        Key={'tenantId': tenant_id}
    )
    
    # 3. Use the tenant's user pool to validate the token
    userpool_id = tenant_details['Item']['userPoolId']
    appclient_id = tenant_details['Item']['appClientId']
    
    # 4. Validate the JWT token
    response = validateJWT(jwt_bearer_token, appclient_id, keys)
```

**Data consistency guarantees**:
- **Atomic operations**: Both Cognito and DynamoDB are updated when a user is created
- **Transactionality**: Ensures the integrity of the associations
- **Validation mechanism**: The authorizer validates the validity of the tenant association

##### ⚡ Association Query Optimization

**Index optimization**:
```yaml
TenantUserMappingTable:
  GlobalSecondaryIndexes: 
    - IndexName: UserName
      KeySchema: 
        - AttributeName: userName    # Supports querying by user name
          KeyType: HASH
        - AttributeName: tenantId    # Supports querying by tenant ID
          KeyType: RANGE
```

**Caching mechanism**:
- **Lambda authorizer cache**: Reduces repeated tenant information lookups
- **User information cache**: Caches frequently used user information
- **Tenant configuration cache**: Caches tenant configuration information

##### 📈 Association Summary

| Component | Association Field | Association Method | Purpose |
|------|----------|----------|------|
| **Cognito User** | `custom:tenantId` | User attribute | Identifies the tenant a user belongs to |
| **TenantDetails** | `tenantId` | Primary key | Stores tenant configuration information |
| **TenantUserMapping** | `tenantId + userName` | Composite key | Establishes the user-tenant mapping |
| **Authorizer** | `custom:tenantId` | JWT claim | Validates the user's tenant permissions |

This association mechanism ensures:
- **Data consistency**: All related data is associated through a unified tenant ID
- **Security**: Multi-layer validation ensures tenant data isolation
- **Performance**: Indexes and caching optimize query performance
- **Scalability**: Supports both pooled and dedicated multi-tenant models

### 🔐 Permission Control Mechanism

#### Role Hierarchy
```python
# Permission levels (highest to lowest)
- SystemAdmin    # System administrator
- TenantAdmin    # Tenant administrator  
- TenantUser     # Tenant user
```

#### Access Control Logic
```python
def update_tenant(event, context):
    requesting_tenant_id = event['requestContext']['authorizer']['tenantId']
    user_role = event['requestContext']['authorizer']['userRole']
    
    # Permission check: tenant admins can only manage their own tenant; system admins can manage all tenants
    if ((auth_manager.isTenantAdmin(user_role) and tenant_id == requesting_tenant_id) 
        or auth_manager.isSystemAdmin(user_role)):
        # Perform the update operation
    else:
        return utils.create_unauthorized_response()
```

### 🎯 Service Tier Management

#### API Key Assignment
```python
def __getApiKey(tenant_tier):
    tier_mapping = {
        'PLATINUM': PLATINUM_TIER_API_KEY,
        'PREMIUM': PREMIUM_TIER_API_KEY, 
        'STANDARD': STANDARD_TIER_API_KEY,
        'BASIC': BASIC_TIER_API_KEY
    }
    return tier_mapping.get(tenant_tier.upper())
```

#### Tenant Isolation Strategy
- **Platinum**: Dedicated infrastructure (Silo model)
- **Premium/Standard/Basic**: Shared infrastructure (Pool model)

### 🔄 Tenant State Management

#### Activation/Deactivation Mechanism
```python
def deactivate_tenant(event, context):
    # 1. Update the tenant state
    table_tenant_details.update_item(
        UpdateExpression="set isActive = :isActive",
        ExpressionAttributeValues={':isActive': False}
    )
    
    # 2. Dedicated tenants need infrastructure destruction
    if dedicatedTenancy == "TRUE":
        invoke_deprovision_tenant(tenant_id)
    
    # 3. Disable all tenant users
    invoke_disable_users(tenant_id)
```

### 🎯 Key Features

1. **Dynamic resource provisioning**: Automatically allocates resources based on tenant tier
2. **Fine-grained permission control**: Role-based, multi-level access control
3. **Automated lifecycle**: A fully automated flow from registration to teardown
4. **Monitoring and auditing**: Complete operation logs and metric records
5. **Elastic scaling**: Supports both pooled and dedicated isolation models

## Analysis of Admin Interface Configuration Relationships (Using the Create Tenant Admin User Interface as an Example)

### 📋 Interface Overview

The `Create Tenant Admin User` interface is a key component of the tenant registration flow, responsible for creating an administrator user for each new tenant. The interface uses AWS SigV4 signature authentication to ensure that only authorized system components can invoke it.

### 🔧 Detailed Configuration Relationships

#### 1. API Gateway Endpoint Definition

**Configuration file**: `server/nested_templates/apigateway.yaml`

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

**Configuration file**: `server/nested_templates/lambdafunctions.yaml`

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

**Configuration file**: `server/nested_templates/apigateway_lambdapermissions.yaml`

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

**Configuration file**: `server/nested_templates/apigateway.yaml`

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

**Configuration file**: `server/nested_templates/lambdafunctions.yaml`

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

**Configuration file**: `server/tenant-template.yaml`

```yaml
OrderTable:
  Type: AWS::DynamoDB::Table
  Properties: 
    AttributeDefinitions:
      - AttributeName: shardId
        AttributeType: S 
      - AttributeName: orderId
        AttributeType: S          
    KeySchema:
      - AttributeName: shardId
        KeyType: HASH 
      - AttributeName: orderId
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
- **Partition key**: `shardId` (used for multi-tenant data isolation)
- **Sort key**: `orderId` (unique order identifier)
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

## Deployment Guide

### Prerequisites
- AWS CLI configured
- AWS SAM CLI installed
- Node.js 20.19+ or 22.12+ installed (required by Angular 20)
- Docker installed (used for SAM builds)

### 1. Deploy Shared Resources
```bash
cd server
sam build -t shared-template.yaml --use-container
sam deploy --config-file shared-samconfig.toml
```

### 2. Deploy Tenant Resources
```bash
sam build -t tenant-template.yaml --use-container
sam deploy --config-file tenant-samconfig.toml
```

### 3. Deploy the Frontend Applications
```bash
# Admin application
cd client/Admin
npm install
npm run build

# Tenant application
cd ../Application
npm install
npm run build

# Landing page
cd ../Landing
npm install
npm run build
```

### 4. Configure and Test
```bash
cd ../../scripts
./deployment.sh
./geturl.sh
```

## Tenant Isolation Models

### Pooled Model
- **Applicable tiers**: Basic, Standard, Premium
- **Characteristics**: Multiple tenants share the same infrastructure
- **Isolation method**: Data isolation achieved through application-layer logic
- **Advantages**: Cost-effective, suitable for small tenants
- **User pool**: Shared Cognito user pool

### Silo Model
- **Applicable tier**: Platinum
- **Characteristics**: Each tenant has independent infrastructure
- **Isolation method**: Physical-level data isolation
- **Advantages**: Higher security, suitable for large enterprise tenants
- **User pool**: Independent Cognito user pool
- **Infrastructure**: A dedicated CloudFormation stack deployed automatically via CodePipeline

## Service Tiers

| Tier | Isolation Model | API Limit | User Pool | Infrastructure | Use Case |
|------|----------|---------|--------|----------|----------|
| Basic | Pooled | Low | Shared | Shared | Small businesses |
| Standard | Pooled | Medium | Shared | Shared | Medium businesses |
| Premium | Pooled | High | Shared | Shared | Large businesses |
| Platinum | Silo | Highest | Independent | Dedicated | Enterprise customers |

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

#### Tiered Alerting Strategy
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

## Security Features

- **Identity authentication**: AWS Cognito user pools
- **API authorization**: Lambda authorizer
- **Data encryption**: Encryption in transit and at rest
- **Network security**: VPC and security group configuration
- **Access control**: IAM roles and policies

## Development Guide

### Local Development
```bash
# Start the local API
sam local start-api

# Start the frontend development server
cd client/Application
ng serve
```

### Testing

Cross-platform test suite (Windows / macOS / Linux); see [`docs/LOCAL_TESTING.md`](docs/LOCAL_TESTING.md) for details:

```bash
# Backend: pytest + moto (in-memory mock DynamoDB, no Docker / AWS required)
pip install -r requirements-test.txt
pytest

# Frontend: Playwright runtime smoke test (first run ng build for each, then)
cd e2e && npm install && npx playwright install chromium && npx playwright test
```

See CI under `.github/workflows/`: `backend-tests.yml` (pytest on three platforms) and `frontend-e2e.yml` (builds the three apps + Playwright).

## Extension and Customization

### Adding a New Service
1. Create a new service directory under `server/`
2. Implement the Lambda functions and the data access layer
3. Update the CloudFormation templates
4. Configure the API Gateway routes

### Customizing Tenant Configuration
1. Modify the tenant table structure
2. Update the tenant management service
3. Adjust the frontend management interface

## Troubleshooting

### Common Issues
1. **Deployment failure**: Check AWS permissions and quotas
2. **API call failure**: Verify the API key and authorization configuration
3. **Frontend inaccessible**: Check the CORS configuration and CloudFront distribution

### Debugging Tools
- CloudWatch Logs
- X-Ray tracing
- API Gateway test console

## Contributing

Contributions are welcome! Please first read [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
Please report security issues privately following [`SECURITY.md`](SECURITY.md). See [`CHANGELOG.md`](CHANGELOG.md) for version changes.

## License

This project is open-sourced under the [MIT-0](LICENSE) license. For upstream provenance and attribution, see [`NOTICE`](NOTICE);
for differences from the upstream Workshop, see [`docs/CHANGES_FROM_WORKSHOP.md`](docs/CHANGES_FROM_WORKSHOP.md).

## Related Resources

- [AWS Serverless Application Model (SAM)](https://aws.amazon.com/serverless/sam/)
- [AWS Lambda](https://aws.amazon.com/lambda/)
- [Amazon API Gateway](https://aws.amazon.com/api-gateway/)
- [Amazon DynamoDB](https://aws.amazon.com/dynamodb/)
- [AWS Cognito](https://aws.amazon.com/cognito/)
- [Angular Framework](https://angular.io/)

## Support

If you have questions or suggestions, please submit feedback via GitHub Issues.
