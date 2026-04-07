# 书签导航

一个基于 Cloudflare Pages、Pages Functions 和 D1 的轻量书签后台。

当前仓库已经收敛到更简单的运行模型：

- 生产部署由 GitHub Actions 自动准备 Pages 项目和 D1 数据库
- 数据库结构只认一份 [`db/schema.sql`](./db/schema.sql)
- 线上不再提供首设密码页、系统诊断页、远程重置数据库页
- 首次登录可使用默认密码 `admin123`，登录后请立即在页面内修改密码

## 项目结构

```text
.tmp-shuqian-nav/
├─ .github/workflows/
│  └─ frontend_pagefunction_deploy.yml
├─ db/
│  └─ schema.sql
├─ pages/
│  ├─ functions/
│  ├─ package.json
│  └─ wrangler.toml
├─ public/
├─ scripts/
│  ├─ reset.cjs
│  └─ setup-config.cjs
├─ package.json
└─ README.md
```

## 运行逻辑

### 本地开发

1. 安装依赖

```bash
npm install
npm --prefix pages install
```

2. 生成本地配置

```bash
npm run config
```

这个命令会生成：

- `pages/wrangler.toml`
- `.dev.vars`

3. 初始化本地 D1

```bash
npm run db:init:local
```

或者：

```bash
npm run reset
```

4. 启动本地开发

```bash
npm run dev
```

如果要强制使用本地模拟模式：

```bash
npm run dev:local
```

### 生产部署

GitHub Actions 会自动完成这些步骤：

1. 安装 `pages/` 目录依赖
2. 校验 `CLOUDFLARE_API_TOKEN`
3. 解析 `CLOUDFLARE_ACCOUNT_ID`
4. 创建或复用 Pages 项目
5. 创建或复用 D1 数据库
6. 执行 `db/schema.sql`
7. 部署 `public/` + `pages/functions/`

工作流文件：

- [`frontend_pagefunction_deploy.yml`](./.github/workflows/frontend_pagefunction_deploy.yml)

## 登录与权限

- 登录页：`/login.html`
- 健康检查：`/api/health`
- 默认管理员密码：`admin123`

密码来源优先级：

1. `ADMIN_PASSWORD` 环境变量
2. D1 中的 `system_config.admin_password`
3. schema 默认写入的 `admin123`

建议：

- 首次进入后立刻修改密码
- 生产环境如果要固定密码，可在环境变量里设置 `ADMIN_PASSWORD`

## 只需要的 GitHub Secrets

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

`CLOUDFLARE_API_TOKEN` 最小建议权限：

- `Account -> Cloudflare Pages: Edit`
- `Account -> D1: Edit`

## 常用命令

| 命令                    | 作用                                          |
| ----------------------- | --------------------------------------------- |
| `npm run config`        | 生成本地 `pages/wrangler.toml` 和 `.dev.vars` |
| `npm run reset`         | 将 `db/schema.sql` 应用到本地 D1              |
| `npm run db:init:local` | 初始化本地 D1                                 |
| `npm run dev`           | 启动 Pages 本地开发                           |
| `npm run dev:local`     | 使用 `--local` 启动 Pages                     |
| `npm run deploy`        | 手动部署到 Pages                              |
| `npm run lint`          | 检查前后端 JS                                 |
| `npm run format:check`  | 检查格式                                      |
| `npm test`              | 运行回归测试、lint、格式检查                  |

## 本地配置示例

`.dev.vars` 最少建议包含：

```env
ADMIN_PASSWORD=change-me-now
JWT_SECRET=your-random-secret
ENVIRONMENT=development
```

## 现在已经删除的旧链路

为了简化维护，下面这些线上入口已经移除：

- `/setup-password`
- `/setup-password.html`
- `/diagnose`
- `/diagnose.html`
- `/api/auth/setup-password`
- `/api/system/diagnose`
- `/api/system/reset-database`
- `/api/system/clear-sample-data`

旧地址会通过 [`public/_redirects`](./public/_redirects) 回到新的入口。

## 故障排查

### 本地执行 `npm test` 时找不到 `eslint`

先安装根目录依赖：

```bash
npm install
```

### 本地执行 `npm run dev` 时找不到 `wrangler`

先安装 `pages/` 目录依赖：

```bash
npm --prefix pages install
```

### GitHub Actions 报 Cloudflare 认证错误

优先检查：

- `CLOUDFLARE_ACCOUNT_ID` 是否正确
- `CLOUDFLARE_API_TOKEN` 是否为 API Token，而不是 Global API Key
- Token 是否同时包含 Pages 和 D1 的编辑权限
- Token 是否能访问目标 Cloudflare Account
