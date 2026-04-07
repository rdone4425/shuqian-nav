# 书签导航

一个基于 Cloudflare Pages、Pages Functions 和 D1 的书签管理项目。

当前仓库的部署结构已经重构为参考 `cloudflare_temp_email` 的分层模式：

- `public/` 负责静态页面资源
- `pages/` 负责 Cloudflare Pages 部署入口
- `pages/functions/` 负责 Pages Functions
- `db/schema.sql` 负责 D1 初始化 schema
- `.github/workflows/frontend_pagefunction_deploy.yml` 负责 CI 部署

## 项目结构

```text
.tmp-shuqian-nav/
├── .github/
│   └── workflows/
│       └── frontend_pagefunction_deploy.yml
├── chrome/
├── db/
│   └── schema.sql
├── pages/
│   ├── functions/
│   ├── package.json
│   └── wrangler.toml
├── public/
├── scripts/
│   ├── reset.cjs
│   └── setup-config.cjs
├── package.json
└── README.md
```

## 技术栈

- Cloudflare Pages
- Cloudflare Pages Functions
- Cloudflare D1
- 原生 HTML、CSS、JavaScript
- Chrome Extension 同步支持

## 快速开始

### 1. 安装依赖

根目录负责项目脚本和基础检查，`pages/` 目录负责 Pages 部署依赖。

```bash
npm install
npm --prefix pages install
```

### 2. 生成本地配置

执行：

```bash
npm run config
```

这个命令会生成：

- `pages/wrangler.toml`
- `.dev.vars`

其中：

- `.dev.vars` 用于本地开发时的 `ADMIN_PASSWORD`、`JWT_SECRET`
- `pages/wrangler.toml` 用于本地 Pages 配置

### 3. 初始化本地 D1

```bash
npm run db:init:local
```

或者：

```bash
npm run reset
```

`reset` 现在的职责很单一，只做一件事：

- 把 `db/schema.sql` 应用到本地 D1

它不再负责生成示例数据，也不再维护多份分散的数据库初始化逻辑。

### 4. 启动本地开发

```bash
npm run dev
```

如果你想强制本地模式：

```bash
npm run dev:local
```

## 常用脚本

| 命令 | 作用 |
| --- | --- |
| `npm run config` | 生成本地 `pages/wrangler.toml` 和 `.dev.vars` |
| `npm run reset` | 将 `db/schema.sql` 应用到本地 D1 |
| `npm run db:init:local` | 直接执行本地 D1 schema 初始化 |
| `npm run db:init:remote` | 直接执行远程 D1 schema 初始化 |
| `npm run dev` | 启动 Pages 本地开发环境 |
| `npm run dev:local` | 以 `--local` 模式启动 Pages |
| `npm run deploy` | 使用 `pages/` 下的 wrangler 执行部署 |
| `npm run lint` | 检查 `public/js/` 和 `pages/functions/` |
| `npm run format:check` | 检查格式 |
| `npm run test` | 运行 `lint + format:check` |

## 部署说明

### 本地部署入口

项目的部署入口已经从“根目录直接跑 Pages”改成“`pages/` 单独负责部署”。

实际执行入口是：

```bash
npm run deploy
```

它等价于：

```bash
npm --prefix pages run deploy
```

### `pages/wrangler.toml`

仓库中的 [pages/wrangler.toml](/E:/app/.tmp-shuqian-nav/pages/wrangler.toml) 默认只保留安全的本地占位配置：

- `name`
- `pages_build_output_dir`
- `compatibility_date`
- `ENVIRONMENT=development`

默认不把生产 D1 绑定直接写死在仓库里。

### 生产配置推荐方式

参考 `cloudflare_temp_email`，推荐通过 GitHub Actions secret 注入生产配置，而不是把正式 `wrangler.toml` 直接提交到仓库。

需要的 GitHub Secrets：

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `PAGE_TOML`

`PAGE_TOML` 示例：

```toml
name = "bookmark-navigator-pages"
pages_build_output_dir = "../public"
compatibility_date = "2026-04-07"

[vars]
ENVIRONMENT = "production"

[[d1_databases]]
binding = "BOOKMARKS_DB"
database_name = "bookmark-navigator"
database_id = "YOUR_D1_DATABASE_ID"
```

## GitHub Actions

当前工作流文件：

- [frontend_pagefunction_deploy.yml](/E:/app/.tmp-shuqian-nav/.github/workflows/frontend_pagefunction_deploy.yml)

它的流程是：

1. 检查 `PAGE_TOML` secret 是否存在
2. 安装 `pages/` 下的部署依赖
3. 用 `PAGE_TOML` 覆盖生成生产用 `pages/wrangler.toml`
4. 调用 `npm --prefix pages run deploy`

如果没有配置 `PAGE_TOML`，工作流会跳过部署步骤。

## D1 数据库

统一 schema 文件：

```text
db/schema.sql
```

这样做的目的是把数据库初始化来源收敛为一个入口，避免出现：

- 一个 API 里维护一份 schema
- 一个脚本里维护一份 schema
- 另一个 SQL 文件里再维护一份 schema

目前仓库里仍然保留部分旧初始化逻辑，但部署主入口已经切到 `db/schema.sql`。

## 本地开发需要的文件

### `.dev.vars`

本地开发通常至少需要这些变量：

```env
ADMIN_PASSWORD=change-me-now
JWT_SECRET=your-random-secret
ENVIRONMENT=development
```

### `pages/wrangler.toml`

本地版本至少要包含：

```toml
name = "bookmark-navigator-pages"
pages_build_output_dir = "../public"
compatibility_date = "2026-04-07"

[vars]
ENVIRONMENT = "development"
```

如果要直接绑定 D1，也可以补上：

```toml
[[d1_databases]]
binding = "BOOKMARKS_DB"
database_name = "bookmark-navigator"
database_id = "YOUR_D1_DATABASE_ID"
```

## 与旧结构的区别

这次重构后，和旧版本相比主要有这些变化：

1. `functions/` 已迁移到 `pages/functions/`
2. 部署入口从根目录移到 `pages/`
3. D1 schema 主入口统一为 `db/schema.sql`
4. `scripts/reset.js`、`scripts/setup-config.js` 已改成 `.cjs`
5. GitHub Actions 改为通过 `PAGE_TOML` secret 注入部署配置

## 故障排查

### `eslint` 找不到

如果执行 `npm run test` 时看到：

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

### 本地 D1 初始化失败

先检查：

- `db/schema.sql` 是否存在
- `wrangler` 是否已安装
- 当前目录是否在项目根目录

再执行：

```bash
npm run db:init:local
```

### 开发环境启动但没有 D1 绑定

先执行：

```bash
npm run config
```

如果是生产环境，请确认 `PAGE_TOML` 里已经包含 `[[d1_databases]]`。

## 后续建议

当前 README 已经和新的部署结构保持一致，但项目本身还有两类事情建议后续继续做：

- 继续把旧的数据库初始化逻辑收敛到 `db/schema.sql`
- 继续修复认证和默认密码相关的安全问题

如果你后面继续迭代部署结构，这份 README 也应该优先同步更新。
