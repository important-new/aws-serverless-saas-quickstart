# Admin 模块功能说明

## 项目概述
Admin 是一个基于 Angular 14 和 AWS Amplify 构建的管理端前端应用，提供完整的租户和用户管理功能。

## 技术架构
- **前端框架**: Angular 14 + RxJS 7
- **UI 组件**: Angular Material + Angular CDK
- **认证系统**: AWS Amplify + Cognito User Pool
- **状态管理**: RxJS + Angular 服务
- **路由系统**: Angular Router (懒加载)

---

## Dashboard 模块

### 功能描述
系统概览仪表板，展示关键指标和快速操作入口

### 主要特性
- 系统概览统计
- 关键指标展示
- 快速操作面板
- 实时数据更新

### 技术实现
- **模块路径**: `views/dashboard`
- **主要组件**: DashboardComponent
- **路由配置**: `/dashboard`
- **懒加载**: 是

### 页面截图
![Dashboard](./screenshots/dashboard.png)

---

## Tenants 模块

### 功能描述
租户管理模块，支持租户的创建、查看、编辑和管理

### 主要特性
- 租户列表展示
- 租户信息创建
- 租户详情编辑
- 租户状态管理

### 技术实现
- **模块路径**: `views/tenants`
- **主要组件**: TenantsComponent
- **路由配置**: `/tenants`
- **懒加载**: 是

### 页面截图
![Tenants](./screenshots/tenants.png)

---

## Users 模块

### 功能描述
用户管理模块，管理系统用户、权限和角色

### 主要特性
- 用户列表管理
- 用户信息创建
- 用户权限设置
- 用户状态控制

### 技术实现
- **模块路径**: `views/users`
- **主要组件**: UsersComponent
- **路由配置**: `/users`
- **懒加载**: 是

### 页面截图
![Users](./screenshots/users.png)

## 部署信息

### 构建命令
```bash
npm run build
```

### 部署方式
- S3 + CloudFront 静态托管
- 支持 CDN 加速和缓存

### 环境配置
- 开发环境: `http://localhost:4200`
- 生产环境: 通过 CloudFormation 自动部署

---

*本文档由自动化脚本生成，最后更新时间: 2025/8/10 22:13:27*
