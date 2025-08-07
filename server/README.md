# Serverless SaaS Reference Architecture - Server

This directory contains the server-side components of the Serverless SaaS Reference Architecture, organized using a modern microservices approach with nested CloudFormation stacks.

## 🏗️ Architecture Overview

The server architecture has been refactored from a monolithic template to a modular, microservices-based structure that provides better maintainability, scalability, and deployment flexibility.

### Directory Structure

```
server/
├── services/                    # Microservices Architecture
│   ├── order-service/          # Order management service
│   │   ├── src/               # Lambda function code
│   │   ├── template.yaml      # SAM template
│   │   └── samconfig.toml     # Deployment configuration
│   ├── product-service/       # Product management service
│   │   ├── src/               # Lambda function code
│   │   ├── template.yaml      # SAM template
│   │   └── samconfig.toml     # Deployment configuration
│   ├── tenant-api/            # API Gateway and integration layer
│   │   ├── template.yaml      # API Gateway configuration
│   │   └── samconfig.toml     # Deployment configuration
│   └── tenant-stack-template.yaml  # Main nested stack orchestrator
├── shared/                     # Shared Infrastructure Components
│   ├── tenant-management/     # Tenant management Lambda functions
│   ├── nested_templates/      # Reusable CloudFormation templates
│   ├── template.yaml          # Shared infrastructure template
│   └── samconfig.toml         # Shared infrastructure config
│   ├── custom_resources/      # Custom CloudFormation resources
│   ├── layers/               # Lambda layers for shared utilities
│   └── auth/                 # Shared Lambda functions (authorizers, etc.)
├── scripts/                   # Deployment and utility scripts
│   ├── deploy-all-services.sh    # Deploy all services
│   ├── deploy-service.sh          # Deploy individual service
│   ├── deploy-shared.sh           # Deploy shared infrastructure
│   └── deploy-tenant-stack.sh    # Deploy tenant stack
└── TenantPipeline/           # CI/CD Pipeline (CDK)
    └── [CDK pipeline configuration]
```

## 🚀 Deployment Guide

### Prerequisites

- AWS CLI configured with appropriate permissions
- SAM CLI installed
- Docker installed (for container builds)

### Deployment Order

1. **Deploy Shared Infrastructure First**
   ```bash
   cd server/shared
   sam build --use-container
   sam deploy --config-file samconfig.toml
   ```

2. **Deploy Individual Services**
   
   **Option A: Deploy All Services at Once**
   ```bash
   cd server/scripts
   ./deploy-all-services.sh
   ```
   
   **Option B: Deploy Services Individually**
   ```bash
   # Deploy Order Service
   cd server/services/order-service
   sam build --use-container
   sam deploy --config-file samconfig.toml
   
   # Deploy Product Service
   cd server/services/product-service
   sam build --use-container
   sam deploy --config-file samconfig.toml
   
   # Deploy Tenant API (depends on above services)
   cd server/services/tenant-api
   sam build --use-container
   sam deploy --config-file samconfig.toml
   ```

3. **Deploy Tenant Stack (Orchestrator)**
   ```bash
   cd server/services
   sam build -t tenant-stack-template.yaml --use-container
   sam deploy --config-file tenant-stack-samconfig.toml
   ```

### Quick Start Scripts

Use the provided scripts for streamlined deployment:

```bash
# Deploy shared infrastructure
./scripts/deploy-shared.sh

# Deploy all microservices
./scripts/deploy-all-services.sh

# Deploy tenant stack
./scripts/deploy-tenant-stack.sh
```

## 🏛️ Architecture Components

### Microservices

#### Order Service
- **Purpose**: Manages order lifecycle (CRUD operations)
- **Resources**: Lambda functions, DynamoDB table, IAM roles
- **Endpoints**: `/orders`, `/order/{id}`

#### Product Service
- **Purpose**: Manages product catalog (CRUD operations)
- **Resources**: Lambda functions, DynamoDB table, IAM roles
- **Endpoints**: `/products`, `/product/{id}`

#### Tenant API
- **Purpose**: API Gateway integration layer with authentication
- **Resources**: API Gateway, Lambda permissions, custom authorizers
- **Features**: Multi-tenant routing, usage plans, throttling

### Shared Infrastructure

#### Core Services
- **Cognito**: User pools for authentication
- **DynamoDB**: Tenant details and settings tables
- **API Gateway**: Admin API for tenant management
- **Lambda Layers**: Shared utilities and dependencies

#### Tenant Management
- **Registration**: New tenant onboarding
- **Provisioning**: Infrastructure provisioning per tenant
- **User Management**: Tenant user lifecycle
- **Configuration**: Tenant-specific settings

## 🔧 Configuration

### Environment-Specific Deployment

Each service supports multiple environments through SAM configuration files:

```toml
# samconfig.toml example
[default.deploy.parameters]
stack_name = "serverless-saas-order-service"
region = "us-east-1"
parameter_overrides = [
    "TenantIdParameter=pooled",
    "StageName=prod"
]
```

### Multi-Tenant Architecture

The architecture supports both:
- **Pooled Tenancy**: Shared resources with tenant isolation
- **Silo Tenancy**: Dedicated resources per tenant

Configuration is controlled via the `TenantIdParameter`:
- `pooled`: Shared infrastructure
- `{tenant-id}`: Dedicated tenant infrastructure

## 🔐 Security Features

- **Custom Authorizers**: JWT token validation and tenant context injection
- **API Key Management**: Tier-based access control
- **IAM Roles**: Least privilege access patterns
- **VPC Integration**: Network-level isolation (optional)

## 📊 Monitoring & Observability

- **CloudWatch Logs**: Centralized logging with tenant context
- **X-Ray Tracing**: Distributed tracing across services
- **Lambda Insights**: Enhanced monitoring and performance metrics
- **Custom Metrics**: Business and operational metrics via PowerTools

## 🔄 CI/CD Pipeline

The `TenantPipeline` directory contains CDK-based CI/CD pipeline configuration for:
- Automated testing
- Multi-environment deployments
- Infrastructure as Code validation
- Security scanning

## 🛠️ Development

### Local Development

```bash
# Start local API
sam local start-api -t services/tenant-api/template.yaml

# Invoke function locally
sam local invoke GetOrdersFunction -t services/order-service/template.yaml
```

### Testing

```bash
# Validate templates
sam validate --template services/order-service/template.yaml --lint
sam validate --template services/product-service/template.yaml --lint
sam validate --template services/tenant-api/template.yaml --lint
```

## 📚 Additional Resources

- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [Multi-Tenant SaaS Patterns](https://aws.amazon.com/solutions/implementations/saas-identity-and-isolation-with-amazon-cognito/)
- [Serverless Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)

## 🤝 Contributing

When adding new services or modifying existing ones:

1. Follow the established directory structure
2. Include proper SAM configuration files
3. Update deployment scripts as needed
4. Maintain consistent naming conventions
5. Document any new dependencies or requirements

---

For questions or issues, please refer to the main project documentation or create an issue in the repository.