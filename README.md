# 书签导航

一个基于 Cloudflare Pages、Pages Functions 和 D1 的书签管理项目。

当前仓库的部署方式已经重构为“仓库内保留本地开发配置，GitHub Actions 自动准备云端资源”的模式，目标是尽量做到和 `cloudflare_temp_email` / `grok2api` 类似的低维护部署体验：

- 不再依赖 `PAGE_TOML` secret
- CI 会自动创建或复用 Cloudflare Pages 项目
- CI 会自动创建或复用 D1 数据库
- CI 会自动执行 `db/schema.sql`
- 生产部署只需要 2 个 GitHub Secrets

## 项目结构

```text
.tmp-shuqian-nav/
├─ .github/
│  └─ workflows/
│     └─ frontend_pagefunction_deploy.yml
├─ chrome/
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

## 技术栈

- Cloudflare Pages
- Cloudflare Pages Functions
- Cloudflare D1
- 原生 HTML / CSS / JavaScript
- Chrome Extension 同步支持

## 本地开发

### 1. 安装依赖

```bash
npm install
npm --prefix pages install
```

### 2. 生成本地配置

```bash
npm run config
```

这个命令会生成：

- `pages/wrangler.toml`
- `.dev.vars`

其中：

- `pages/wrangler.toml` 只用于本地开发
- `.dev.vars` 用于本地开发时的 `ADMIN_PASSWORD`、`JWT_SECRET` 等变量

### 3. 初始化本地 D1

```bash
npm run db:init:local
```

或者：

```bash
npm run reset
```

### 4. 启动本地开发环境

```bash
npm run dev
```

如果想强制使用本地模拟模式：

```bash
npm run dev:local
```

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run config` | 生成本地 `pages/wrangler.toml` 和 `.dev.vars` |
| `npm run reset` | 将 `db/schema.sql` 应用到本地 D1 |
| `npm run db:init:local` | 初始化本地 D1 |
| `npm run dev` | 启动 Pages 本地开发 |
| `npm run dev:local` | 使用 `--local` 启动 Pages |
| `npm run deploy` | 手动部署到 Pages |
| `npm run lint` | 检查 `public/js/` 和 `pages/functions/` |
| `npm run format:check` | 检查格式 |
| `npm run test` | 运行 `lint + format:check` |

## GitHub Actions 一键部署

工作流文件：

- [frontend_pagefunction_deploy.yml](/E:/app/.tmp-shuqian-nav/.github/workflows/frontend_pagefunction_deploy.yml)

触发方式：

- push 到 `main`
- 手动执行 `workflow_dispatch`

CI 流程如下：

1. 安装 `pages/` 下的部署依赖
2. 调用 Cloudflare API，自动创建或复用 Pages 项目
3. 调用 Cloudflare API，自动创建或复用 D1 数据库
4. 把 `BOOKMARKS_DB` 绑定写入 Pages 项目配置
5. 执行 `db/schema.sql`
6. 把 `public/` 和 `pages/functions/` 部署到 Cloudflare Pages

### 只需要这 2 个 GitHub Secrets

在 GitHub 仓库里配置：

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

不再需要：

- `PAGE_TOML`

### 默认的云端资源名称

当前 workflow 默认使用下面这组名字：

- Pages 项目名：`bookmark-navigator-pages`
- D1 数据库名：`bookmark-navigator`
- D1 绑定名：`BOOKMARKS_DB`
- 生产分支：`main`

如果你想改名字，直接修改工作流顶部的 `env` 即可。

### `CLOUDFLARE_API_TOKEN` 需要什么权限

最小建议权限：

- `Account -> Cloudflare Pages: Edit`
- `Account -> D1: Edit`

资源范围建议：

- 只选择当前项目所在的 Cloudflare Account

不建议使用：

- Global API Key
- 超出当前部署需要的高权限 Token

### 为什么需要这两个权限

- `Cloudflare Pages: Edit`
  用于创建或更新 Pages 项目，以及执行 Pages 部署
- `D1: Edit`
  用于创建或复用 D1 数据库，并执行 `db/schema.sql`

## 手动部署

如果你不想走 GitHub Actions，也可以手动部署。

### 1. 先准备本地 Pages 配置

```bash
npm run config
```

如果要手动部署到远程环境，请确保本地 `pages/wrangler.toml` 里已经包含远程 D1 绑定，例如：

```toml
name = "bookmark-navigator-pages"
pages_build_output_dir = "../public"
compatibility_date = "2026-04-07"

[vars]
ENVIRONMENT = "development"

[[d1_databases]]
binding = "BOOKMARKS_DB"
database_name = "bookmark-navigator"
database_id = "YOUR_D1_DATABASE_ID"
```

### 2. 部署到 Pages

```bash
npm run deploy
```

当前 `pages/package.json` 默认会按 `main` 分支部署：

```bash
wrangler pages deploy ../public --branch main
```

## 本地配置文件说明

### `pages/wrangler.toml`

这个文件现在默认只承担本地开发配置职责，仓库里保留的是安全占位版本。

生产环境不再依赖仓库内提交的 `wrangler.toml`，而是由 GitHub Actions 通过 Cloudflare API 直接写入 Pages 项目配置。

### `.dev.vars`

本地开发建议至少包含：

```env
ADMIN_PASSWORD=change-me-now
JWT_SECRET=your-random-secret
ENVIRONMENT=development
```

## D1 结构入口

统一 schema 文件：

```text
db/schema.sql
```

现在默认把数据库初始化入口收敛到这里，避免 schema 分散在多个脚本和 API 文件里。
远程环境不再提供页面内手动初始化入口，生产初始化统一交给 CI 执行。

## 与旧部署方式的区别

这次重构后，和旧版本相比主要有这些变化：

1. `functions/` 已迁移到 `pages/functions/`
2. 部署入口收口到 `pages/`
3. D1 schema 统一到 `db/schema.sql`
4. `scripts/reset.js`、`scripts/setup-config.js` 已改为 `.cjs`
5. GitHub Actions 不再依赖 `PAGE_TOML`
6. GitHub Actions 会自动准备 Pages 项目和 D1 数据库

## 故障排查

### `eslint` 找不到

如果执行 `npm run test` 时看到类似报错：

```text
'eslint' is not recognized as an internal or external command
```

通常说明根目录依赖还没安装：

```bash
npm install
```

### `wrangler` 找不到

通常说明 `pages/` 下依赖还没安装：

```bash
npm --prefix pages install
```

### GitHub Actions 部署失败

优先检查：

- `CLOUDFLARE_ACCOUNT_ID` 是否正确
- `CLOUDFLARE_API_TOKEN` 是否存在
- Token 是否同时包含 `Cloudflare Pages: Edit` 和 `D1: Edit`
- 当前 Cloudflare Account 下是否允许创建 Pages / D1 资源

如果日志里出现：

```text
Authentication error
```

或者：

```text
Cloudflare token verification failed
```

通常说明：

- `CLOUDFLARE_API_TOKEN` 填的不是 API Token，而是 Global API Key
- Token 已过期、被删除，或被重新生成过
- `CLOUDFLARE_ACCOUNT_ID` 和 token 对应的账号不一致

如果日志里出现类似：

```text
CLOUDFLARE_ACCOUNT_ID does not match any account accessible by this token
```

说明：

- `CLOUDFLARE_ACCOUNT_ID` 填错了
- token 的资源范围没有覆盖这个账号
- 你在 Cloudflare 后台复制了另一个账号的 ID

### 本地 D1 初始化失败

优先检查：

- `db/schema.sql` 是否存在
- 当前目录是否在项目根目录
- `pages/` 依赖是否已经安装

然后再执行：

```bash
npm run db:init:local
```

## 后续建议

部署链路已经简化，但项目本身仍建议继续处理一类问题：

- 继续修复认证、默认口令和鉴权边界相关的安全问题
