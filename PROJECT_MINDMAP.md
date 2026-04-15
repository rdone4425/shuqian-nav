# shuqian-nav 项目脑图

> 仓库：`https://github.com/rdone4425/shuqian-nav`
>
> 本文件是项目结构脑图的 Markdown 版本，包含 Mermaid 脑图和文字大纲两种形式。

## Mermaid 脑图

```mermaid
mindmap
  root((shuqian-nav))
    产品定位
      书签导航后台
      Cloudflare Pages + Functions + D1
      不只是导航页
        登录认证
        回收站
        链接检查
        统计分析
        AI Wiki
        自动备份
    前端页面层
      public/index.html
        主导航页
      public/login.html
        登录入口
      其他页面
        import.html
        deleted-bookmarks.html
        link-checker.html
        notifications.html
        token.html
        ai-settings.html
      公共资源
        public/css
        public/components/header.html
        _headers
        _redirects
    前端JS层
      public/js/app.js
        主应用控制器
      public/js/auth.js
        登录登出
        token校验
        重定向
      public/js/wiki-view.js
        本地视图
        AI视图
        命令面板
      其他模块
        bookmarks.js
        import.js
        deleted-bookmarks.js
        i18n.js
        ui-enhancements.js
        utils
    后端API层
      pages/functions/_middleware.js
        CORS
        安全头
        基础拦截
      认证API
        api/auth/login
        api/auth/verify
        api/auth/change-password
        api/auth/token
      书签API
        api/bookmarks/index.js
        api/bookmarks/[id].js
        api/bookmarks/categories.js
        api/bookmarks/import.js
        api/bookmarks/deleted.js
        api/bookmarks/sync.js
        api/bookmarks/keep-status.js
        api/bookmarks/[id]/visit.js
      系统与扩展API
        api/health.js
        api/system/*
        api/analytics/index.js
        api/wiki/index.js
        api/cron/weekly-check.js
    后端工具层
      database-helper.js
        查询
        分页
        批量执行
      auth-middleware.js
      jwt-manager.js
      response-helper.js
      业务工具
        backup-manager.js
        deleted-bookmarks.js
        bookmark-analytics.js
        performance-monitor.js
        validation.js
        ai-client.js
        ai-wiki.js
    数据库层
      db/schema.sql
        system_config
        categories
        bookmarks
        deleted_bookmarks
        bookmark_visits
        daily_analytics
        search_logs
        user_sessions
        popularity_cache
        category_analytics
      初始化内容
        默认admin密码
        站点标题
        AI配置项
        默认分类
    认证安全
      密码优先级
        ADMIN_PASSWORD 环境变量
        D1 system_config.admin_password
        默认 admin123
      JWT 登录态
      前端鉴权守卫
      中间件安全头
    AI Wiki能力
      api/wiki/index.js
        读取快照
        生成快照
      ai-wiki.js
        去重
        聚类
        调用AI
        fallback生成
      wiki-view.js
        展示AI Wiki
    部署运维
      .github/workflows/frontend_pagefunction_deploy.yml
      pages/wrangler.toml
      scripts/setup-config.cjs
      scripts/reset.cjs
      本地命令
        npm run config
        npm run db:init:local
        npm run reset
        npm run dev
    主流程
      用户访问页面
      认证校验
      调用业务API
      D1读写
      增强处理
        统计
        链接检查
        AI Wiki
        备份
      GitHub Actions 自动部署
```

## 文字大纲

## 1. 项目定位

- `shuqian-nav` 是一个部署在 Cloudflare 平台上的书签导航后台。
- 技术组合是 `Cloudflare Pages + Pages Functions + D1`。
- 它不只是一个书签展示页，而是一个带后台能力的小型管理系统。
- 主要增强能力包括：
  - 登录认证
  - 回收站
  - 链接检查
  - 访问统计
  - Token 管理
  - AI Wiki
  - 自动备份

## 2. 前端页面层

- 目录：`public/`
- 主要页面：
  - `[index.html](/E:/app/shuqian-nav/public/index.html)`：主导航页
  - `[login.html](/E:/app/shuqian-nav/public/login.html)`：登录页
  - `[import.html](/E:/app/shuqian-nav/public/import.html)`：导入页
  - `[deleted-bookmarks.html](/E:/app/shuqian-nav/public/deleted-bookmarks.html)`：回收站页
  - `[link-checker.html](/E:/app/shuqian-nav/public/link-checker.html)`：链接检查页
  - `[notifications.html](/E:/app/shuqian-nav/public/notifications.html)`：通知页
  - `[token.html](/E:/app/shuqian-nav/public/token.html)`：Token 页面
  - `[ai-settings.html](/E:/app/shuqian-nav/public/ai-settings.html)`：AI 配置页
- 公共资源：
  - `public/css/`
  - `public/components/header.html`
  - `public/_headers`
  - `public/_redirects`

## 3. 前端 JS 层

- 目录：`public/js/`
- 核心文件：
  - `[app.js](/E:/app/shuqian-nav/public/js/app.js)`：主应用控制器，负责初始化、事件绑定、书签页交互、设置面板
  - `[auth.js](/E:/app/shuqian-nav/public/js/auth.js)`：处理登录登出、token 校验、认证状态、跳转
  - `[wiki-view.js](/E:/app/shuqian-nav/public/js/wiki-view.js)`：Wiki 风格知识库视图，支持本地/AI 视图切换
- 其他模块：
  - `bookmarks.js`
  - `deleted-bookmarks.js`
  - `import.js`
  - `i18n.js`
  - `ui-enhancements.js`
  - `utils/api.js`
  - `utils/dom-helper.js`
  - `utils/sorting.js`
  - `utils/storage.js`
  - `utils/ui-helper.js`

## 4. 后端 API 层

- 目录：`pages/functions/`
- 全局中间件：
  - `[_middleware.js](/E:/app/shuqian-nav/pages/functions/_middleware.js)`
  - 负责：
    - CORS
    - 安全响应头
    - 本地开发与生产来源区分
    - 基础可疑请求拦截
- 认证 API：
  - `api/auth/login.js`
  - `api/auth/verify.js`
  - `api/auth/change-password.js`
  - `api/auth/token.js`
- 书签 API：
  - `api/bookmarks/index.js`
  - `api/bookmarks/[id].js`
  - `api/bookmarks/categories.js`
  - `api/bookmarks/import.js`
  - `api/bookmarks/deleted.js`
  - `api/bookmarks/sync.js`
  - `api/bookmarks/keep-status.js`
  - `api/bookmarks/[id]/visit.js`
- 系统/扩展 API：
  - `api/health.js`
  - `api/system/*`
  - `api/analytics/index.js`
  - `api/wiki/index.js`
  - `api/cron/weekly-check.js`

## 5. 后端工具层

- 目录：`pages/functions/utils/`
- 核心工具：
  - `[database-helper.js](/E:/app/shuqian-nav/pages/functions/utils/database-helper.js)`：统一 D1 查询、分页、批量执行
  - `[auth-middleware.js](/E:/app/shuqian-nav/pages/functions/utils/auth-middleware.js)`：统一鉴权包装
  - `jwt-manager.js`
  - `response-helper.js`
- 业务工具：
  - `backup-manager.js`
  - `deleted-bookmarks.js`
  - `[bookmark-analytics.js](/E:/app/shuqian-nav/pages/functions/utils/bookmark-analytics.js)`
  - `performance-monitor.js`
  - `validation.js`
  - `ai-client.js`
  - `[ai-wiki.js](/E:/app/shuqian-nav/pages/functions/utils/ai-wiki.js)`

## 6. 数据库层

- 文件：`[db/schema.sql](/E:/app/shuqian-nav/db/schema.sql)`
- 这是项目唯一可信的数据库结构源。
- 主要表：
  - `system_config`
  - `categories`
  - `bookmarks`
  - `deleted_bookmarks`
  - `bookmark_visits`
  - `daily_analytics`
  - `search_logs`
  - `user_sessions`
  - `popularity_cache`
  - `category_analytics`
- 初始化内容：
  - 默认管理员密码
  - 站点标题和描述
  - AI 配置项
  - 默认分类

## 7. 认证与安全

- 密码优先级：
  1. `ADMIN_PASSWORD` 环境变量
  2. D1 中 `system_config.admin_password`
  3. 默认值 `admin123`
- 登录成功后发放 JWT。
- 前端 `auth.js` 负责本地 token 管理和失效跳转。
- 后端通过 `_middleware.js` 和 `authenticateRequest()` 完成 API 访问控制。

## 8. AI Wiki 能力

- 入口：`[pages/functions/api/wiki/index.js](/E:/app/shuqian-nav/pages/functions/api/wiki/index.js)`
- 负责：
  - 读取已有 AI Wiki 快照
  - 基于现有书签重新生成 AI Wiki 快照
  - 将快照写入 `system_config`
- 核心逻辑：`[ai-wiki.js](/E:/app/shuqian-nav/pages/functions/utils/ai-wiki.js)`
  - 书签去重
  - 分类聚合
  - 构造 AI 消息
  - 调用 AI
  - 失败时 fallback 生成结构
- 前端展示：`[wiki-view.js](/E:/app/shuqian-nav/public/js/wiki-view.js)`

## 9. 部署与运维

- GitHub Actions：
  - `[frontend_pagefunction_deploy.yml](/E:/app/shuqian-nav/.github/workflows/frontend_pagefunction_deploy.yml)`
- 本地 Pages 包装配置：
  - `[pages/wrangler.toml](/E:/app/shuqian-nav/pages/wrangler.toml)`
- 脚本：
  - `[scripts/setup-config.cjs](/E:/app/shuqian-nav/scripts/setup-config.cjs)`：生成本地配置
  - `[scripts/reset.cjs](/E:/app/shuqian-nav/scripts/reset.cjs)`：重置/初始化本地 D1
- 常用命令：
  - `npm run config`
  - `npm run db:init:local`
  - `npm run reset`
  - `npm run dev`

## 10. 系统主流程

1. 用户访问页面
2. 前端执行认证校验
3. 页面调用对应 API
4. Pages Functions 操作 D1
5. 根据需要执行统计、链接检查、AI Wiki、备份等增强逻辑
6. GitHub Actions 自动把静态页和 Functions 发布到 Cloudflare Pages

## 11. 一句话总结

- 这个项目本质上是一个“小而完整的 Cloudflare 后台系统”。
- 表面是书签导航，底层已经具备：
  - 认证
  - CRUD
  - 回收站
  - 统计分析
  - AI 知识整理
  - 自动部署

