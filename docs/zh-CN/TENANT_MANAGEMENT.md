[English](../TENANT_MANAGEMENT.md) ｜ [**中文**](TENANT_MANAGEMENT.md)

[← 返回 README](../../README.zh-CN.md)

---

## 平台租户管理实现

### 🏗️ 核心架构

#### 数据存储层
```yaml
# 四个核心DynamoDB表
- ServerlessSaaS-TenantDetails      # 租户基本信息
- ServerlessSaaS-TenantStackMapping # 租户与基础设施映射
- ServerlessSaaS-TenantUserMapping  # 租户用户映射
- ServerlessSaaS-Settings           # 系统配置
```

#### 服务层
- **租户注册服务** (`tenant-registration.py`)
- **租户供应服务** (`tenant-provisioning.py`) 
- **租户管理服务** (`tenant-management.py`)
- **用户管理服务** (`user-management.py`)

### 🔄 租户生命周期管理

#### 租户注册流程
```python
def register_tenant(event, context):
    # 1. 生成租户ID和API密钥
    tenant_id = uuid.uuid1().hex
    api_key = get_api_key_by_tier(tenant_tier)
    
    # 2. 创建租户管理员用户
    create_user_response = __create_tenant_admin_user(tenant_details)
    
    # 3. 创建租户记录
    create_tenant_response = __create_tenant(tenant_details)
    
    # 4. 专用租户需要供应基础设施
    if dedicatedTenancy == 'TRUE':
        provision_tenant_response = __provision_tenant(tenant_details)
```

#### 租户供应机制
```python
def provision_tenant(event, context):
    # 1. 记录租户与CloudFormation栈映射
    table_tenant_stack_mapping.put_item({
        'tenantId': tenant_id,
        'stackName': f'stack-{tenant_id}',
        'applyLatestRelease': True
    })
    
    # 2. 触发CodePipeline部署专用基础设施
    codepipeline.start_pipeline_execution(
        name='serverless-saas-pipeline'
    )
```

### 👥 用户管理机制

#### 多租户用户池策略
- **池化租户**: 共享Cognito用户池
- **专用租户**: 独立Cognito用户池

#### 用户创建流程
```python
def create_tenant_admin_user(event, context):
    if dedicatedTenancy == 'true':
        # 创建专用用户池
        user_pool = create_user_pool(tenant_id)
        app_client = create_user_pool_client(user_pool_id)
    else:
        # 使用共享用户池
        user_pool_id = TENANT_USER_POOL_ID
        
    # 创建租户组和管理员用户
    create_user_group(user_pool_id, tenant_id)
    create_tenant_admin(user_pool_id, tenant_admin_user_name)
```

#### 租户信息关联机制

##### 🔗 核心关联字段

**租户ID (tenantId)**:
- **作用**: 作为所有关联关系的唯一标识符
- **格式**: UUID格式的字符串 (如: `abc123-def456-ghi789`)
- **生成**: 在租户注册时通过 `uuid.uuid1().hex` 生成

##### 📊 关联关系架构

**Cognito用户池 ↔ DynamoDB关联**:
```python
# 租户注册时的关联建立
def create_tenant_admin_user(event, context):
    tenant_details = json.loads(event['body'])
    tenant_id = tenant_details['tenantId']  # 核心关联字段
    
    # 1. 创建或选择用户池
    if (tenant_details['dedicatedTenancy'] == 'true'):
        user_pool_response = user_mgmt.create_user_pool(tenant_id)
        user_pool_id = user_pool_response['UserPool']['Id']
    else:
        user_pool_id = tenant_user_pool_id
    
    # 2. 在DynamoDB中存储租户配置
    tenant_config = {
        'tenantId': tenant_id,
        'userPoolId': user_pool_id,  # 关联字段
        'appClientId': app_client_id,
        'apiGatewayUrl': api_gateway_url,
        'apiKey': api_key
    }
    
    # 3. 在Cognito中创建用户时设置租户属性
    create_tenant_admin_response = user_mgmt.create_tenant_admin(
        user_pool_id, 
        tenant_admin_user_name, 
        tenant_details
    )
```

**用户 ↔ 租户关联**:
```python
# 用户创建时的关联建立
def create_user(event, context):
    # 1. 从授权器获取当前租户信息
    tenant_id = event['requestContext']['authorizer']['tenantId']
    user_pool_id = event['requestContext']['authorizer']['userPoolId']
    
    # 2. 在Cognito中创建用户时设置租户属性
    response = client.admin_create_user(
        Username=user_details['userName'],
        UserPoolId=user_pool_id,
        UserAttributes=[
            {
                'Name': 'custom:tenantId',  # 关键关联属性
                'Value': tenant_id
            },
            {
                'Name': 'custom:userRole',
                'Value': user_details['userRole']
            }
        ]
    )
    
    # 3. 在DynamoDB中创建用户-租户映射
    user_mgmt.create_user_tenant_mapping(user_details['userName'], tenant_id)
```

##### 🔍 关联查询流程

**从Cognito到DynamoDB的查询**:
```python
def get_users(event, context):
    tenant_id = event['requestContext']['authorizer']['tenantId']
    user_pool_id = event['requestContext']['authorizer']['userPoolId']
    
    # 1. 从Cognito获取用户列表
    response = client.list_users(UserPoolId=user_pool_id)
    
    # 2. 通过custom:tenantId属性过滤同租户用户
    for user in response['Users']:
        for attr in user["Attributes"]:
            if(attr["Name"] == "custom:tenantId" and attr["Value"] == tenant_id):
                # 找到同租户用户
                user_info = UserInfo()
                user_info.tenant_id = attr["Value"]  # 关联字段
                user_info.user_name = user["Username"]
                users.append(user_info)
```

**从DynamoDB到Cognito的查询**:
```python
def get_user_info(event, user_pool_id, user_name):
    # 1. 从Cognito获取用户详细信息
    response = client.admin_get_user(
        UserPoolId=user_pool_id,
        Username=user_name
    )
    
    # 2. 提取租户ID
    user_info = UserInfo()
    for attr in response["UserAttributes"]:
        if(attr["Name"] == "custom:tenantId"):
            user_info.tenant_id = attr["Value"]  # 关联字段
            break
    
    # 3. 可以通过tenant_id查询DynamoDB中的租户详情
    tenant_details = table_tenant_details.get_item(
        Key={'tenantId': user_info.tenant_id}
    )
    
    return user_info
```

##### 📋 数据表关联结构

**TenantDetails表**:
```yaml
# 存储租户配置信息
TenantDetailsTable:
  KeySchema:
    - AttributeName: tenantId  # 主键
      KeyType: HASH
  Attributes:
    - tenantId: "abc123"       # 关联字段
    - userPoolId: "us-east-1_xxxxxxxxx"  # Cognito用户池ID
    - appClientId: "xxxxxxxxxxxxxxxxxxxxxxxxxx"
    - apiGatewayUrl: "https://abc123.execute-api.us-east-1.amazonaws.com/prod/"
    - apiKey: "xxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**TenantUserMapping表**:
```yaml
# 存储用户-租户映射关系
TenantUserMappingTable:
  KeySchema:
    - AttributeName: tenantId   # 分区键
      KeyType: HASH
    - AttributeName: userName   # 排序键
      KeyType: RANGE
  Attributes:
    - tenantId: "abc123"        # 关联字段
    - userName: "tenant-admin-abc123"
```

**Cognito用户属性**:
```json
{
  "Username": "tenant-admin-abc123",
  "UserAttributes": [
    {
      "Name": "custom:tenantId",    // 关键关联属性
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

##### 🔧 关联维护机制

**租户注册时的关联建立**:
```python
def register_tenant(event, context):
    # 1. 生成租户ID
    tenant_id = uuid.uuid1().hex
    
    # 2. 创建租户管理员用户
    create_user_response = __create_tenant_admin_user(tenant_details)
    
    # 3. 创建租户记录
    create_tenant_response = __create_tenant(tenant_details)
    
    # 4. 专用租户需要供应基础设施
    if dedicatedTenancy == 'TRUE':
        provision_tenant_response = __provision_tenant(tenant_details)
```

**用户创建时的关联维护**:
```python
def create_user_tenant_mapping(self, user_name, tenant_id):
    # 确保用户创建后立即建立映射关系
    response = table_tenant_user_map.put_item(
        Item={
            'tenantId': tenant_id,    # 关联字段
            'userName': user_name
        }
    )
    return response
```

**用户查询时的关联验证**:
```python
def get_user(event, context):
    tenant_id = event['requestContext']['authorizer']['tenantId']
    user_name = event['pathParameters']['username']
    
    # 1. 从Cognito获取用户信息
    user_info = get_user_info(event, user_pool_id, user_name)
    
    # 2. 验证租户关联
    if(not auth_manager.isSystemAdmin(user_role) and user_info.tenant_id != tenant_id):
        return utils.create_unauthorized_response()
```

##### 🛡️ 关联安全性

**授权器中的关联验证**:
```python
def lambda_handler(event, context):
    # 1. 从JWT Token中提取租户ID(PyJWT;先不验证签名读取声明,
    #    签名在第 4 步验证)
    unauthorized_claims = jwt.decode(jwt_bearer_token, options={"verify_signature": False})
    tenant_id = unauthorized_claims['custom:tenantId']
    
    # 2. 查询租户详情验证关联
    tenant_details = table_tenant_details.get_item(
        Key={'tenantId': tenant_id}
    )
    
    # 3. 使用租户的用户池验证Token
    userpool_id = tenant_details['Item']['userPoolId']
    appclient_id = tenant_details['Item']['appClientId']
    
    # 4. 验证JWT Token
    response = validateJWT(jwt_bearer_token, appclient_id, keys)
```

**数据一致性保证**:
- **原子操作**: 用户创建时同时更新Cognito和DynamoDB
- **事务性**: 确保关联关系的完整性
- **验证机制**: 通过授权器验证租户关联的有效性

##### ⚡ 关联查询优化

**索引优化**:
```yaml
TenantUserMappingTable:
  GlobalSecondaryIndexes: 
    - IndexName: UserName
      KeySchema: 
        - AttributeName: userName    # 支持按用户名查询
          KeyType: HASH
        - AttributeName: tenantId    # 支持按租户ID查询
          KeyType: RANGE
```

**缓存机制**:
- **Lambda授权器缓存**: 减少重复的租户信息查询
- **用户信息缓存**: 缓存常用的用户信息
- **租户配置缓存**: 缓存租户的配置信息

##### 📈 关联关系总结

| 组件 | 关联字段 | 关联方式 | 作用 |
|------|----------|----------|------|
| **Cognito用户** | `custom:tenantId` | 用户属性 | 标识用户所属租户 |
| **TenantDetails** | `tenantId` | 主键 | 存储租户配置信息 |
| **TenantUserMapping** | `tenantId + userName` | 复合键 | 建立用户-租户映射 |
| **授权器** | `custom:tenantId` | JWT声明 | 验证用户租户权限 |

这种关联机制确保了：
- **数据一致性**: 通过统一的租户ID关联所有相关数据
- **安全性**: 通过多层验证确保租户数据隔离
- **性能**: 通过索引和缓存优化查询性能
- **可扩展性**: 支持池化和专用两种多租户模式

### 🔐 权限控制机制

#### 角色层次
```python
# 权限等级（从高到低）
- SystemAdmin    # 系统管理员
- TenantAdmin    # 租户管理员  
- TenantUser     # 租户用户
```

#### 访问控制逻辑
```python
def update_tenant(event, context):
    requesting_tenant_id = event['requestContext']['authorizer']['tenantId']
    user_role = event['requestContext']['authorizer']['userRole']
    
    # 权限检查：租户管理员只能管理自己的租户，系统管理员可管理所有租户
    if ((auth_manager.isTenantAdmin(user_role) and tenant_id == requesting_tenant_id) 
        or auth_manager.isSystemAdmin(user_role)):
        # 执行更新操作
    else:
        return utils.create_unauthorized_response()
```

### 🎯 服务等级管理

#### API密钥分配
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

#### 租户隔离策略
- **Platinum**: 专用基础设施 (Silo模式)
- **Premium/Standard/Basic**: 共享基础设施 (Pool模式)

### 🔄 租户状态管理

#### 激活/停用机制
```python
def deactivate_tenant(event, context):
    # 1. 更新租户状态
    table_tenant_details.update_item(
        UpdateExpression="set isActive = :isActive",
        ExpressionAttributeValues={':isActive': False}
    )
    
    # 2. 专用租户需要销毁基础设施
    if dedicatedTenancy == "TRUE":
        invoke_deprovision_tenant(tenant_id)
    
    # 3. 禁用所有租户用户
    invoke_disable_users(tenant_id)
```

### 🎯 关键特性

1. **动态资源供应**: 根据租户等级自动分配资源
2. **细粒度权限控制**: 基于角色的多层次访问控制
3. **自动化生命周期**: 从注册到销毁的全自动化流程
4. **监控和审计**: 完整的操作日志和指标记录
5. **弹性扩展**: 支持池化和专用两种隔离模式

---

[← 返回 README](../../README.zh-CN.md)
