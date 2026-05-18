# Home Web

[English](./README.md)

Home Web 是 Home 自托管个人与家庭管理套件的 React 前端，为 `home-admin` 提供桌面管理后台和
移动端 `/m` H5 应用。它覆盖任务、家庭保险、家庭圈、实时群聊、文件、通知、RBAC 和 API Key
管理，适合想把个人事务和家庭协作放在自己服务器上的用户。

这个项目不是空壳管理模板，而是一个已经接入真实业务模块的前端。你可以直接运行，也可以按现有模块模式继续扩展。

## 功能亮点

- 桌面管理后台：React 18、Vite 7、TypeScript、Ant Design 5、Tailwind CSS、TanStack Query
  和 Zustand。
- 移动端 H5：通过 `/m` 访问，支持家庭任务、保险、通知、个人资料、家庭圈和群聊。
- 后端驱动动态路由：从 `/menus/user-menus` 获取菜单，按菜单懒加载页面组件，并结合权限控制显示。
- RBAC 管理：用户、角色、菜单、权限的完整管理界面。
- 任务中心：清单、今日、日历、四象限、纪念日多视图。
- 任务能力：附件、检查项、标签、负责人、重复规则、提醒稍后处理、持续提醒。
- 家庭保险：成员、保单、家庭视图、附件、状态标签、缴费日期和移动端提醒视图。
- 家庭圈与群聊：图片/视频上传、评论、回复、点赞，以及 Socket.IO 实时刷新。
- 文件管理：本地或 OSS 存储，公开/私有访问，预览、下载和临时访问链接。
- 通知中心：未读角标、标记已读、全部已读、通知跳转和移动端通知页。
- API 应用管理：应用、密钥、权限范围、一次性密钥展示、访问日志和接入说明。
- 自动化任务页：Cron 配置、手动执行和执行日志。
- 深色模式、响应式布局、类型化服务层和 Vitest 单元/组件测试。

## 页面入口

Vite 构建包含两个 SPA 入口：

```text
/      桌面管理后台
/m     移动端 H5 应用
```

桌面端大部分业务页面由后端菜单决定。移动端提供更适合日常使用的固定路由：

```text
/m/tasks
/m/tasks/:id
/m/insurance
/m/insurance/:id
/m/family
/m/family/compose
/m/family/chat
/m/notifications
/m/profile
```

## 技术栈

- React 18 与 React Router 7
- Vite 7 + SWC
- TypeScript 5.9
- Ant Design 5 与 antd-mobile 5
- Tailwind CSS 4
- TanStack Query 5
- Zustand 5
- Axios
- Socket.IO client
- Vitest 与 Testing Library

## 环境要求

- Node.js `>=20.19.0 || >=22.12.0`
- pnpm `>=9`
- 正在运行的 `home-admin` 后端，默认地址为 `http://localhost:3000`

## 快速开始

```bash
pnpm install
pnpm dev
```

访问：

```text
http://localhost:3001
http://localhost:3001/m
```

开发环境下，Vite 会把 `/api` 和 `/socket.io` 代理到 `http://localhost:3000`。

## 环境变量

可以创建 `.env.local`，也可以直接参考 `.env.example`：

```bash
VITE_API_URL=http://localhost:3000/api/v1
VITE_APP_TITLE=home 管理后台
VITE_FAMILY_MEDIA_UPLOAD_MODE=local
VITE_ASSET_BASE_URL=
```

生产环境使用内置 nginx 镜像时，推荐使用同源 API 路径：

```bash
VITE_API_URL=/api/v1
VITE_FAMILY_MEDIA_UPLOAD_MODE=oss
VITE_ASSET_BASE_URL=https://assets.grin.cool/assets/home/
```

`VITE_FAMILY_MEDIA_UPLOAD_MODE=oss` 会让家庭圈/群聊媒体走浏览器直传，但后端也必须启用 OSS。
否则会使用普通后端 multipart 上传。

`VITE_ASSET_BASE_URL` 是构建期静态资源 CDN 前缀，用于让生成的 JS/CSS 走 CDN。
阿里云 OSS/CDN 配置见 [`docs/aliyun-cdn-assets.md`](docs/aliyun-cdn-assets.md)。

## 常用命令

```bash
pnpm dev             # 启动 Vite，默认端口 3001
pnpm build           # 类型检查并构建桌面端和移动端入口
pnpm preview         # 预览生产构建
pnpm lint            # 执行 ESLint
pnpm format:check    # 检查 src 下的 Prettier 格式
pnpm test --run      # 执行一次 Vitest
pnpm test:coverage   # 执行覆盖率测试
```

## 项目结构

```text
src/
  app/               桌面端 Provider、动态路由、组件注册表
  mobile/            移动端入口、路由、页面和样式
  features/
    api-auth/        API 应用、密钥、权限范围、访问日志、接入说明
    auth/            登录、个人资料、密码、认证状态
    automation/      Cron 任务配置和执行日志
    dashboard/       管理后台统计卡片和快捷入口
    family/          家庭圈、媒体、群聊服务、实时 socket
    file/            文件列表、上传、预览、访问链接
    insurance/       家庭成员、保单、附件、提醒
    notification/    通知列表、铃铛、hooks、通知跳转
    rbac/            用户、角色、菜单、权限管理
    task/            任务清单、多视图、表单、附件、重复规则
  shared/            布局、权限守卫、hooks、stores、请求工具、类型
  assets/styles/     全局样式和主题样式
```

## 后端契约

Home Web 需要与 `home-admin` 配合使用。前端服务层位于 `src/features/**/services`，目前是手写
类型和请求封装；后端接口变更后，应同步检查后端 controller 和生成的 Swagger/OpenAPI 契约。

关键接入点：

- `VITE_API_URL` 指向后端版本化 API，通常是 `/api/v1`。
- `/menus/user-menus` 决定桌面端路由和侧边栏。
- 登录后通过 auth store 管理 JWT access token 与 refresh token。
- 家庭实时刷新依赖 `/socket.io`。
- 文件 URL 可能是公开地址、后端临时访问链接或 OSS 跳转地址，取决于后端存储配置。

## Docker

Docker 镜像会构建桌面端和移动端两个入口，并通过 nginx 提供静态服务。运行时 nginx 使用
`API_UPSTREAM` 把 `/api` 和 `/socket.io` 转发到后端。

```bash
pnpm docker:build
pnpm docker:run
```

也可以在工作区根目录使用 Docker Compose 启动完整栈。

## 测试

当前项目使用 Vitest 和 Testing Library 做单元测试和组件测试，不包含 E2E/Playwright 配置。

```bash
pnpm test --run
pnpm lint
pnpm build
```

## 为什么使用它

Home Web 适合需要一个真实可用、自托管、可继续扩展的个人后台的人。它已经覆盖了很多通用管理模板没有做完的日常场景：家庭任务、重复提醒、保险记录、共享媒体、通知、API Key 接入和 RBAC。
代码规模仍然可读，但功能已经足够支撑实际使用。
