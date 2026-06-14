[**English**](TENANT_MANAGEMENT.md) ｜ [中文](zh-CN/TENANT_MANAGEMENT.md)

[← Back to README](../README.md)

---

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

---

[← Back to README](../README.md)
