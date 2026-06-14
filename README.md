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
aws-serverless-saas-quickstart/
├── server/                              # Backend services
│   ├── shared/                          # Shared (control-plane) stack
│   │   ├── template.yaml                # Shared resources CloudFormation/SAM template
│   │   ├── samconfig.toml               # SAM config (stack: saas-control-stack)
│   │   ├── nested_templates/            # Nested CloudFormation templates
│   │   ├── custom_resources/            # Custom resources (e.g. usage-plan association)
│   │   ├── layers/                      # Lambda layer dependencies
│   │   ├── auth/                        # Authorizer and shared auth resources
│   │   └── tenant-management/           # Tenant registration / provisioning / user mgmt
│   ├── services/                        # Tenant (application-plane) stack
│   │   ├── template.yaml                # Tenant resources template (nested apps)
│   │   ├── samconfig.toml               # SAM config (stack: stack-pooled)
│   │   ├── product-service/             # Product management service
│   │   ├── order-service/               # Order management service
│   │   └── tenant-api/                  # Tenant API authorizer + throttling/monitoring
│   └── TenantPipeline/                  # Tenant deployment pipeline (CDK)
├── client/                              # Frontend applications
│   ├── Admin/                           # System administrator interface
│   ├── Application/                     # Tenant application interface
│   └── Landing/                         # Landing / sign-up page
├── e2e/                                 # Playwright cross-platform smoke tests
├── scripts/                             # Deployment and helper scripts
└── docs/                                # Detailed documentation (see below)
```

## Detailed Documentation

This README is the high-level entry point. The in-depth architecture deep-dives live under [`docs/`](docs/):

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — overview pointer (technical stack, DB design, structure)
- [`docs/TENANT_MANAGEMENT.md`](docs/TENANT_MANAGEMENT.md) — platform tenant management implementation (lifecycle, user/tenant association, RBAC, tiering)
- [`docs/API_CONFIGURATION.md`](docs/API_CONFIGURATION.md) — Admin and tenant API configuration-relationship deep-dives
- [`docs/THROTTLING_AND_MONITORING.md`](docs/THROTTLING_AND_MONITORING.md) — monitoring/operations, usage-plan throttling, and the CloudWatch throttling-metric mechanism
- [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md) ｜ [`docs/LOCAL_TESTING.md`](docs/LOCAL_TESTING.md) ｜ [`docs/CHANGES_FROM_WORKSHOP.md`](docs/CHANGES_FROM_WORKSHOP.md) ｜ [`docs/DEPENDENCY_AUDIT.md`](docs/DEPENDENCY_AUDIT.md)

Chinese versions of the deep-dives are under [`docs/zh-CN/`](docs/zh-CN/).

## Core Services

### 1. Product Service (server/services/product-service)
- CRUD operations for products
- Supports multi-tenant data isolation
- Integrates monitoring and logging

### 2. Order Service (server/services/order-service)
- CRUD operations for orders
- Order-product association management
- Tenant-level data access control

### 3. Tenant API (server/services/tenant-api)
- Tenant request authorization (Lambda authorizer)
- Per-tenant API throttling and CloudWatch monitoring

### 4. Tenant Management (server/shared/tenant-management)
- Tenant registration and configuration
- Tenant activation/deactivation
- User management and permission control
- Tenant resource provisioning

### 5. Frontend Applications
- **Admin** (`client/Admin`): System administrator console for managing tenants and users
- **Application** (`client/Application`): Tenant business application for managing products and orders
- **Landing** (`client/Landing`): Tenant registration and login page

## Deployment Guide

### Prerequisites
- AWS CLI configured
- AWS SAM CLI installed
- Node.js 20.19+ or 22.12+ installed (required by Angular 20)
- Docker installed (used for SAM builds)

> The backend is split into two stacks: the **shared / control-plane** stack
> (`server/shared`) and the **tenant / application-plane** stack
> (`server/services`). Deploy the shared stack first.

### 1. Deploy Shared Resources
```bash
cd server/shared
sam build -t template.yaml --use-container
sam deploy --config-file samconfig.toml
```

### 2. Deploy Tenant Resources (pooled)
```bash
cd ../services
sam build -t template.yaml --use-container
sam deploy --config-file samconfig.toml
```

### 3. (Optional) Deploy the Tenant Pipeline for Platinum (silo) provisioning
```bash
cd ../TenantPipeline
npm install
cdk bootstrap
cdk deploy --require-approval never
```

### 4. Deploy the Frontend Applications
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

### 5. Configure and Test
```bash
cd scripts
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

