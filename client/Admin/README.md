## 项目概览

Admin 是一个使用 Angular 14 构建的管理端前端应用，集成 AWS Amplify（Cognito User Pool）完成用户认证，通过全局 HTTP 拦截器为 API 请求自动附加 ID Token 进行后端鉴权。路由采用懒加载模块，顶层使用 `AmplifyAuthenticator` 门户在 UI 层完成“登录后可见”的访问控制。

## 技术栈

- **框架**: Angular 14, RxJS 7
- **UI**: Angular Material, Angular CDK, Flex Layout, Bootstrap
- **认证**: AWS Amplify UI + Cognito User Pool (`@aws-amplify/ui-angular`, `aws-amplify`)
- **网络**: Angular `HttpClient` + 自定义 `HttpInterceptor`
- **部署**: S3/CloudFront（脚本使用 AWS CLI 从 CloudFormation 读取输出并同步静态资源）

## 认证与鉴权

- **Amplify 配置**: 在 `src/main.ts` 中调用 `Amplify.configure` 读取 `src/aws-exports.ts`，指向 Cognito User Pool。
- **登录门户**: 根组件 `app.component.ts` 使用 `amplify-authenticator` 包裹应用内容，未登录用户将看到 Amplify 的登录界面；登录成功后显示路由内容。

  ```ts
  // src/app/app.component.ts（节选）
  template: ` <amplify-authenticator [hideSignUp]="true">
    <ng-template amplifySlot="authenticated">
      <router-outlet></router-outlet>
    </ng-template>
  </amplify-authenticator>`
  ```

- **会话与登出**: 使用 `Auth.currentSession()` 获取当前会话；`Auth.signOut({ global: true })` 退出登录（见 `views/auth/AuthComponent`）。
- **后端鉴权（令牌附加）**: 自定义拦截器 `AuthInterceptor`（在 `app/interceptors` 提供）对除包含 `tenant/init` 的请求外的所有 HTTP 请求读取当前会话 ID Token，并在请求头加入 `Authorization: Bearer <JWT>`：

  ```ts
  // src/app/interceptors/auth.interceptor.ts（节选）
  return from(Auth.currentSession()).pipe(
    filter((sesh) => !!sesh),
    map((sesh) => sesh.getIdToken().getJwtToken()),
    switchMap((tok) => next.handle(req.clone({
      headers: req.headers.set('Authorization', 'Bearer ' + tok),
    })))
  );
  ```

- **权限控制策略**:
  - 前端未实现基于角色的路由守卫（无 `CanActivate`/`CanLoad` 等守卫）。
  - 访问控制依赖 `AmplifyAuthenticator` 的“登录后可见”，以及后端基于 JWT 的细粒度授权。

## 路由与导航

- **顶层路由**: `AppRoutingModule` 将根路径重定向至 `dashboard`，并以 `NavComponent` 作为布局组件承载子路由：

  ```ts
  // src/app/app-routing.module.ts（节选）
  const routes: Routes = [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    { path: '', component: NavComponent, children: [
      { path: 'auth/info', component: AuthComponent },
      { path: 'dashboard', loadChildren: () => import('./views/dashboard/dashboard.module').then(m => m.DashboardModule) },
      { path: 'tenants', loadChildren: () => import('./views/tenants/tenants.module').then(m => m.TenantsModule) },
      { path: 'users', loadChildren: () => import('./views/users/users.module').then(m => m.UsersModule) },
    ]},
  ];
  ```

- **功能模块路由**:
  - `DashboardModule`: 默认组件 `DashboardComponent`。
  - `TenantsModule`: `list`、`create` 路由。
  - `UsersModule`: `list`、`create` 路由。
  - 均未配置前端守卫，所有已登录用户均可访问。
- **导航菜单**: 菜单项配置在 `src/app/_nav.ts`，由 `NavComponent` 渲染，用户名等信息来自 Cognito ID Token（`cognito:username`、`custom:company-name`）。
- **路由策略**: 使用 `HashLocationStrategy` 以兼容静态资源托管（S3/CloudFront）。

## 关键组件与模块

- **`NavComponent`**: 布局和侧边导航，监听 `Router` 事件控制加载动效，从 Cognito 会话流提取用户名与企业名。
- **`AuthComponent`**: 认证调试页，展示 Access/ID Token 与当前会话，并提供登出按钮。
- **`AuthInterceptor`**: 为 API 请求自动附加 `Authorization` 头（排除 `tenant/init`）。
- **功能模块**: `dashboard`、`tenants`、`users` 采用懒加载。
- **服务**: 例如 `UsersService` 通过 `environment.apiUrl` 调用后端 `/users`、`/user` 接口。
- **环境配置**: `src/environments/*.ts` 提供 `apiUrl`、`region` 等；`aws-exports.ts` 提供 Cognito 配置。

## 目录结构（简要）

- `src/app/app.module.ts`、`app-routing.module.ts`: 应用模块与路由
- `src/app/interceptors/*`: HTTP 拦截器与提供者
- `src/app/nav/*`: 布局与导航
- `src/app/views/*`: 功能模块（dashboard/tenants/users/auth）
- `src/environments/*`: 环境变量
- `src/aws-exports.ts`: Amplify/Cognito 配置

## 本地开发

- 安装依赖: `npm install`
- 启动开发服务器: `npm start` 或 `ng serve`，访问 `http://localhost:4200/`
- 需确保 `src/aws-exports.ts` 指向可用的 Cognito User Pool，并且 `src/environments/environment.ts` 的 `apiUrl` 可达。

## 构建

- 打包: `npm run build` 或 `ng build`，产物位于 `dist/`

## 部署（S3/CloudFront）

- 脚本中提供：
  - `npm run deploy`: 通过 AWS CLI 从名为 `saas-control-stack` 的 CloudFormation 堆栈读取 `AdminSiteBucket` 输出，并将 `dist/` 同步至 S3。
  - `npm run reset`: 对 CloudFront 分发执行失效（需在脚本中配置分发 ID）。
- 先决条件：本地已配置 AWS CLI 凭证，且具有访问 CloudFormation/S3/CloudFront 的权限。

## 权限与路由控制的扩展建议

- 如需前端基于角色的控制，可新增守卫（如 `CanActivate`）读取 `Auth.currentSession()` 的 ID Token Claim（例如 Cognito 组或自定义 Claim），结合路由 `data` 元信息决定放行与否。
- 导航菜单可基于角色/Claim 进行动态过滤。
- 如需白名单更多无需鉴权的接口，可在 `AuthInterceptor` 中扩展排除逻辑。

SaaS平台Admin功能页面说明

页面左侧是导航栏，可以收起或展开；右侧是对应页面的内容。

### 导航栏：
The left sidebar includes navigation options like "Dashboard," "Tenants," and "Users," which help users manage and monitor various aspects of the SaaS platform.

### Dashboard 页面：
* **租户概览**：页面显示租户总数，以及不同service plans的租户数量。

### Tenants 页面：

* **租户概览**：页面显示租户的列表，包括每个租户的ID、租户名称、邮箱、计划和状态。

  * 例如，有两个租户列出：`share1` 和 `silo1`，每个租户都有唯一的ID和邮箱。
  * 租户的服务计划分别为 **Standard** 和 **Platinum**，并且它们的状态显示为 `true`，表明租户是活跃的。
* **添加租户按钮**：在列表下方有一个“Add Tenant”按钮，点击后可跳转到租户添加表单。

### 添加租户表单：

* **表单字段**：点击“Add Tenant”按钮后，弹出一个表单，包含以下字段：

  * **名称**：租户的名称。
  * **邮箱**：租户的邮箱地址。
  * **电话**：租户的电话号码。
  * **地址**：租户的地址。
  * **计划**：一个下拉菜单，允许管理员选择租户的服务计划（如 Standard、Premium 等）。
* **提交与取消选项**：表单提供提交按钮用于添加租户，或提供取消按钮放弃操作。

### Users 页面：

* **用户概览**：页面显示用户的列表，包括每个用户邮箱、创建时间、修改时间、Status和Enabled（是否启用）。

  * Enabled可以是 `true`或`false`。
  * Status可以是 `CONFIRMED`或`PENDINg`。

* **添加用户按钮**：在列表下方有一个“Add User”按钮，点击后可跳转到用户添加表单。

### 添加用户表单：

* **表单字段**：点击“Add User”按钮后，弹出一个表单，包含以下字段：

  * **名称**：用户的名称。
  * **邮箱**：用户的邮箱地址。
  * **角色**：用户的角色。
  * **租户ID**：租户的ID。
* **提交与取消选项**：表单提供提交按钮用于添加用户，或提供取消按钮放弃操作。

### 总结：

该功能用于管理SaaS平台中的租户，管理员可以通过此功能添加新租户，填写相关信息，分配服务计划，并查看租户的当前状态。这是多租户SaaS平台中的关键功能，支持平台的可扩展性。


1. 整体布局结构

采用经典的管理后台左右布局设计:

左侧为可折叠的导航菜单栏
右侧为主要内容区域
采用白色主题，确保整体视觉清爽专业
2. 导航栏设计

左侧导航栏包含:

Logo置于顶部
下方依次排列：Dashboard、Tenants、Users三个主要导航项
底部设置折叠/展开按钮
选中状态使用高亮底色标识
3. Dashboard页面

采用数据卡片布局:

顶部显示租户总数的大数字卡片
下方使用柱状图展示不同service plans的租户数量分布
图表配有图例说明和交互式提示
4. Tenants页面

表格化展示租户信息:

顶部配置搜索栏和筛选器
表格包含列：ID、租户名称、邮箱、计划、状态
底部设置分页控制器
右上角放置Add Tenant按钮
表格支持排序和多选操作
5. 添加租户表单

模态框形式的表单设计:

表单标题清晰可见
字段垂直排列：名称、邮箱、电话、地址、计划
计划选项使用下拉选择器
底部操作按钮：取消(次要按钮)、确认添加(主要按钮)
所有字段配有验证提示
6. Users页面

表格化展示用户信息:

顶部配置搜索和筛选功能
表格包含列：邮箱、创建时间、修改时间、Status、Enabled
Status和Enabled使用标签样式展示
右上角放置Add User按钮
底部分页控制
7. 添加用户表单

模态框形式的表单设计:

清晰的表单标题
字段垂直排列：名称、邮箱、角色、租户ID
角色使用下拉选择器
租户ID支持搜索选择
底部操作按钮：取消、确认添加
配有必填项标识和验证提示