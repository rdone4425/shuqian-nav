# 从「书签工作台」到「导航站」的重构方案

> 状态：提案（待第 10 节决策确认）
> 关联：`docs/refactor-roadmap.md`（旧的首页/后台拆分）、`docs/admin-ui-unification-plan.md`（后台 UI）
> 前提：继续使用 Cloudflare Pages + Pages Functions + D1，不引入前端框架

## 1. 结论（TL;DR）

- **产品定位从「个人书签管理」转为「公开导航站」**：访客不登录就能浏览、搜索、点击站点；管理员只负责收录、排序、分类和运维。
- **不改技术栈**，但改三件事：
  1. 数据模型补上导航站必需的能力：排序、置顶、推荐、显隐、图标、点击统计、站点设置。
  2. 公开首页从「客户端拉 JSON 再渲染」改成「服务端渲染 HTML + 边缘缓存」，SEO 和首屏一起解决。
  3. 后台从「书签 CRUD」收敛为「站点 CMS」，9 个页面合并为 5 个左右。
- **先修 3 个已复现的问题**（`/b/:id` XSS、cron 兜底密钥、本地 dev 库不一致），再动结构。
- 不引入 React/Astro；不搞多用户；不先做后台 SPA 迁移。
- 预计 2 周左右（单人、按阶段验收），其中公开站是价值最高的一段。

## 2. 目标形态

### 2.1 访客侧（公开、无需登录）

- 首页：品牌 + 全局搜索 + 分类锚点 + 按分类分组的站点卡片。
- 卡片：图标、名称、一句话描述、分类色点；**不显示访问次数/最近访问/"HOT"**（那是工作台语义）。
- 搜索：即时过滤（名称/描述/URL/标签），`/` 聚焦；数据量大后再做服务端搜索。
- 点击站点走 `/go/:id` 302 跳转，顺带记录点击（可统计、可检测死链、可加 `nofollow`）。
- 深色模式、移动端单列、键盘可达。
- SEO：完整 HTML、`<title>`/description/canonical/OG/JSON-LD、`sitemap.xml`、`robots.txt`、RSS。
- 页脚：关于、RSS、站点地图、备案信息（可配置）、后台入口（低调）。

### 2.2 管理员侧

- 5 个入口：概览（真实点击统计）、站点、分类、导入/工具、设置。
- 站点列表支持：拖拽/上下移动排序、置顶、推荐、显示/隐藏、图标上传、批量移动/删除。
- 设置页管理：站点名、Logo、描述、页脚、备案号、统计代码、首页布局开关。
- 保留现有运维能力：导入、Chrome 同步、链接检查、回收站、备份、改密码。

### 2.3 明确不做

- 多用户/个人收藏夹/权限体系（单管理员足够）。
- 开放投稿（放到 Phase 4，可选；要做就接 Turnstile）。
- 一期不做后台 SPA、不做静态站点生成器、不做多语言。

## 3. 现状与差距

| 维度 | 现状 | 导航站目标 | 动作 |
| --- | --- | --- | --- |
| 公开首页 | 客户端渲染，拉 `/api/bookmarks?limit=5000`，显示访问次数/"HOT" | 服务端渲染 HTML + 边缘缓存，站点目录 | 重写 |
| 数据模型 | 只有 title/url/desc/category/tags/favorite | 加排序、置顶、推荐、显隐、点击 | 迁移 |
| 图标 | 热链 `www.google.com/s2/favicons` | **继续使用 Google s2**，首字母兜底 | 保留 |
| 分类 | 2 级（`category_hierarchy`），无排序/描述 | 加 slug/排序/图标/显隐 | 迁移 |
| 点击 | 只自增 `visit_count`，分析表从不写入 | `/go/:id` 落库 + 真实统计 | 重写 |
| 后台 | 9 个页面 + 重复菜单定义 + 半成品 SPA | 5 个页面，数据源唯一 | 收敛 |
| 样式 | 首页 85KB CSS（含 65KB workspace-refresh） | 公开站独立 ~15KB | 重写 |
| SEO | 首页空 HTML；sitemap 硬编码域名且只收 `/b/:id` | SSR + 正确 sitemap/robots | 重写 |
| 迁移 | 只有一份 `schema.sql`，CI 每次重放，无法加列 | `schema.sql` + 版本化 migration runner | 新增 |

## 4. 架构决策

### 4.1 公开页渲染方式

| 方案 | 做法 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- | --- |
| A 现状 CSR | 静态 HTML + JS 拉 API | 零改动 | 首屏空、SEO 差、数据越多越慢 | 否 |
| B SSR + 边缘缓存 | `_middleware.js` 拦截 `/`，查 D1 渲染 HTML，`Cache-Control` + `caches.default` 缓存 | 无框架、SEO 完整、内容实时、改动集中 | 要写模板和缓存失效 | **推荐** |
| C 构建期静态化 | CI 里用 Node 读 D1 生成 `index.html` | 最快、最省 Worker 调用 | 新增构建链，后台改内容后要重新部署 | 二期可选 |

B 的落地要点：

- 只在 `request.method === "GET"` 且 `pathname === "/"`（以及后续的 `/c/:slug`）时渲染，其余请求直接 `next()`，避免影响 API 和静态资源。
- 缓存 key 带内容版本（`SELECT MAX(updated_at)` 或 `system_config.nav_version`），TTL `s-maxage=300, stale-while-revalidate=86400`。
- 渲染失败时返回一个静态兜底页，不要让首页 500。
- 客户端 JS 只做「增强」：搜索、筛选、深色模式、复制，不依赖 JS 也能浏览。

### 4.2 数据模型

- **保留表名 `bookmarks` / `categories`**，只在 UI 上叫「站点」；避免改表名带来的同步、备份、测试连锁改动。
- 新增字段用版本化 migration，**不要写进 `schema.sql` 的重复执行路径**（SQLite 的 `ALTER TABLE ADD COLUMN` 不能重复执行）。
- **新列上的索引只能放在 migration 里**：CI 先 apply `schema.sql` 再 migrate，旧库此时还没有新列，`schema.sql` 里任何引用新列的 `CREATE INDEX` 都会先失败。`tests/migration.test.js` 用 `node:sqlite` 覆盖「旧库 → schema → migration」路径。
- `schema.sql` 保持「全新安装的当前快照」；`db/migrations/*.mjs` 负责存量库升级，runner 用 `schema_migrations` 记录版本，执行前用 `PRAGMA table_info` 做幂等保护。

### 4.3 图标

- **已确认继续使用 `https://www.google.com/s2/favicons?domain=<host>&sz=...`**，不新增 R2 或图标代理。
- `bookmarks.favicon_url` 已经由创建/更新/导入/同步流程写入 s2 地址，导航卡片直接用它。
- 前端统一 `loading="lazy"` + `onerror` 切首字母块；已有 `getFaviconInitial()` 逻辑可复用。
- 以后若要自托管，再加 `icon_url` 字段和 `/api/icon/:domain`，不影响现在的数据结构。

### 4.4 点击统计

- 所有站点链接改成 `/go/:id`（302），handler 里：`UPDATE bookmarks SET click_count = click_count + 1, last_click_at = ...` + `INSERT INTO nav_clicks`，用 `context.waitUntil` 保证不阻塞跳转。
- `nav_clicks` 只存 `bookmark_id / clicked_at / referrer / country / device`，不存 IP。
- 后台概览用真实数据替换现在的假趋势图；`daily_nav_stats` 由 cron 或查询时聚合。

### 4.5 后台形态

- **暂缓 SPA 迁移**：`admin-router.js` 是死代码，先删除；`admin-menu.js` 保留为唯一路由数据源，`site-menu.js` 不再维护第二份后台菜单。
- 多页结构继续用，但把 9 页合并为 5 页（见 6.2）；每个页面新增的排序/显隐/推荐字段直接加到现有表格。
- 等公开站稳定后，再决定是否完成 SPA。

## 5. 数据模型变更（草案）

分工：`db/schema.sql` 是「全新安装的当前快照」（直接包含下列新列），`db/migrations/0001_nav.mjs` 只负责存量库升级——逐个用 `PRAGMA table_info` 判断列/表是否存在，再决定是否执行 ALTER，因此可以安全重跑。下面是要执行的语句（示意）：

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE categories ADD COLUMN slug TEXT;
ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE categories ADD COLUMN is_visible INTEGER DEFAULT 1;

ALTER TABLE bookmarks ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE bookmarks ADD COLUMN is_pinned INTEGER DEFAULT 0;
ALTER TABLE bookmarks ADD COLUMN is_featured INTEGER DEFAULT 0;
ALTER TABLE bookmarks ADD COLUMN is_visible INTEGER DEFAULT 1;
ALTER TABLE bookmarks ADD COLUMN status TEXT DEFAULT 'active'; -- active | hidden | broken
ALTER TABLE bookmarks ADD COLUMN click_count INTEGER DEFAULT 0;
ALTER TABLE bookmarks ADD COLUMN last_click_at TEXT;
ALTER TABLE bookmarks ADD COLUMN no_follow INTEGER DEFAULT 0;
ALTER TABLE bookmarks ADD COLUMN sponsored INTEGER DEFAULT 0;
ALTER TABLE bookmarks ADD COLUMN source TEXT DEFAULT 'manual'; -- manual | import | sync | submit
ALTER TABLE bookmarks ADD COLUMN seo_description TEXT;

CREATE INDEX IF NOT EXISTS idx_bookmarks_nav_order
  ON bookmarks(is_visible, category_id, is_pinned DESC, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_categories_nav_order
  ON categories(is_visible, sort_order, id);

CREATE TABLE IF NOT EXISTS nav_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bookmark_id INTEGER NOT NULL,
  clicked_at TEXT DEFAULT CURRENT_TIMESTAMP,
  referrer TEXT,
  user_agent TEXT,
  country TEXT,
  device TEXT
);
CREATE INDEX IF NOT EXISTS idx_nav_clicks_bookmark ON nav_clicks(bookmark_id, clicked_at DESC);
```

- 存量数据回填：`UPDATE categories SET slug = 'c-' || id WHERE slug IS NULL`，`bookmarks` 用 `sort_order = id` 保持现有顺序；`click_count` 先用 `visit_count` 初始化。
- 迁移 runner：`node scripts/migrate.mjs [--local|--remote]`，CI 在 apply schema 之后执行；migration 内部先查 `PRAGMA table_info`，重复执行不报错。
- 可选：`db/seed-nav.sql` 提供一套导航站分类（AI、开发、设计、产品、效率、资源、影音、阅读、社区），只在本地或首次部署时用，不要每次 CI 都插。

## 6. 路由与页面

### 6.1 公开

| 路由 | 说明 | 渲染 |
| --- | --- | --- |
| `/` | 首页：推荐 + 分类分组 + 搜索 | SSR + 边缘缓存 |
| `/go/:id` | 点击跳转 + 计数 | Function 302 |
| `/b/:id` | 单站分享页（`noindex`） | Function，修复转义 |
| `/feed.xml` | RSS（复用现有 feed 逻辑） | Function |
| `/sitemap.xml` | 首页 + 分类 + 站点（用请求 origin，不写死域名） | Function |
| `/robots.txt` | 放行公开页，屏蔽 `/admin*`、`/api`、`/go` | 静态 |
| `/about` | 关于/说明（可选） | 静态 |

> 数量 < 300 个站点时，首页单页承载全部内容即可；超过后再加 `/c/:slug` 分类页。

### 6.2 后台

| 路由 | 合并自 | 说明 |
| --- | --- | --- |
| `/admin`（或 `admin-dashboard.html`） | 概览 | 真实点击排行、最近收录、死链摘要 |
| `/sites.html` | bookmarks-manage | 站点表格：排序、置顶、推荐、显隐、图标、批量 |
| `/categories.html` | categories | 分类：slug、排序、图标、显隐 |
| `/import.html` | import + 回收站 + 链接检查 | 工具页，用 tab 分区 |
| `/settings.html` | admin-settings + token + notifications | 站点设置、密码、令牌、备份、通知策略 |

## 7. 代码改动地图

| 路径 | 动作 | 说明 |
| --- | --- | --- |
| `db/schema.sql` + `db/migrations/*` | 改/增 | 新字段、迁移 runner |
| `pages/functions/_middleware.js` | 改 | 首页 SSR 分发 + CSP + 缓存头 |
| `pages/functions/nav/render.js` | 增 | 首页 HTML 模板（分类分组、卡片、JSON-LD） |
| `pages/functions/api/nav.js` | 增 | 公开读模型（可见站点 + 分类），ETag |
| `pages/functions/go/[id].js` | 增 | 点击跳转 + 统计 |
| `pages/functions/api/icon/[domain].js` | 暂不做 | 图标继续用 Google s2 |
| `pages/functions/api/bookmarks/index.js` | 改 | 只服务后台/扩展；加排序/显隐字段 |
| `pages/functions/api/analytics/*` | 重写/删 | 去掉内存分析，接 `nav_clicks` |
| `pages/functions/api/cron/weekly-check.js` | 改 | 去掉兜底密钥 |
| `pages/functions/sitemap.xml.js` | 重写 | 不写死域名，补分类/站点 |
| `public/index.html` | 重写 | 新导航首页骨架（SSR 兜底） |
| `public/css/nav.css` | 增 | 公开站样式（目标 < 20KB），替代 `workspace-refresh.css` |
| `public/js/nav/*` | 增 | 搜索/筛选/主题/卡片增强 |
| `public/js/home/*` | 删/合并 | i18n/storage/sorting/dom-helper/ui-helper 大多可去掉 |
| `public/js/shared/site-menu.js` | 拆 | 公开菜单与后台菜单分离，不再把后台入口打进公开包 |
| `public/js/shared/admin-router.js` | 删 | 未接线的 SPA |
| `public/js/shared/admin-menu.js` | 保留 | 唯一后台路由数据源 |
| `public/js/admin/*` | 改 | 站点/分类/设置页加新字段 |
| `public/css/workspace-refresh.css` | 删/瘦身 | 65KB，公开站不再加载 |
| `public/css/token-enhanced.css`、`subpages.css` | 删 | 无引用 |
| `pages/functions/utils/database-helper.js`、`auth-middleware.js` | 删 | 无引用 |
| `scripts/audit-loading-matrix.mjs` | 改 | 按新的公开/后台矩阵更新，或改为从 `admin-menu.js` 推导 |
| `tests/api-core.test.js` | 改/拆 | 增加真实 SQLite（`node:sqlite`）集成测试 |

## 8. 分阶段实施

### Phase 0 — 安全与基线（0.5–1 天）

- 修 `/b/:id` 属性注入 XSS；所有入口统一 http/https 校验（含 `sync.js`）。
- cron 未配置 `CRON_SECRET` 时失败关闭。
- 去掉 `dev` 脚本里的 `--d1 BOOKMARKS_DB`，恢复「init + dev」可用。
- 修 `admin-dashboard.html` 的 `\u...` 字面量；删死代码；补 CSP。
- 产出：`npm test` 全绿、截图基线。

### Phase 1 — 数据与迁移（2–3 天）

- 迁移 runner + `0001_nav.sql` + 回填脚本。
- `/go/:id` + `nav_clicks` + `click_count`。
- 后台站点/分类加字段（排序、置顶、推荐、显隐、slug、图标）。
- 产出：存量库可升级，测试覆盖迁移幂等。

### Phase 2 — 公开导航站（3–4 天）

- SSR 首页 + 边缘缓存 + 静态兜底。
- 新 `nav.css` + `nav.js` + `/feed.xml`/`sitemap`/`robots`。
- 去掉公开包里的后台菜单/后台 API。
- 产出：Lighthouse 移动端 ≥ 90、首屏无 JS 也能浏览、SEO 检查通过。

### Phase 3 — 后台收敛（2–3 天）

- 5 页结构（可先用现有页面改，不做 SPA）。
- 拖拽/上下移动排序、批量显隐、站点设置页。
- 真实统计替换假趋势图。
- 产出：管理员 10 分钟内能完成「加一个站点并排序」的完整流程。

### Phase 4 — 可选（按需）

- 开放投稿（Turnstile + 审核队列）。
- 分类页 `/c/:slug`、FTS5 搜索。
- 构建期静态化（如果边缘缓存仍不够快）。
- PWA/离线、RSS 增强。

## 9. 验收清单

- **功能**：访客无 JS 可浏览/点击；搜索、分类、深色模式、移动端可用；后台排序/显隐生效。
- **SEO**：`curl -A Googlebot /` 返回完整内容；sitemap 无死链；canonical/OG/JSON-LD 正确；`/go` 不索引。
- **性能**：公开首页 HTML < 30KB、CSS < 20KB、JS < 30KB（gzip）；Lighthouse 移动端 ≥ 90。
- **安全**：所有写接口 401；URL 仅 http/https；分享页转义完整；CSP 生效；cron 无兜底密钥。
- **质量**：`npm test` 全绿；新增 migration/SSR/点击统计测试；`audit-loading-matrix` 与新结构同步。
- **运维**：`db:init:local` + `npm run dev` 得到同一份库；CI 部署自动跑 migration。

## 10. 待确认决策

1. **定位**：公开导航站（默认）/ 只给自己用的主页？——决定要不要做 SSR 和 SEO。
2. **收录方式**：仅管理员（默认）/ 开放投稿？——决定是否做 submissions + Turnstile。
3. **图标**：已确认继续使用 Google s2，不做 R2 自托管。
4. **后台**：先维持多页、暂缓 SPA（默认）/ 本次一起完成 SPA？

## 11. 风险与对策

- **首页 SSR 拖慢 API**：middleware 只在文档请求时渲染，其余直接 `next()`；渲染走缓存。
- **迁移把线上库改坏**：migration 幂等 + 先备份（现成 backup-manager）+ CI 先 apply schema 再 migrate。
- **公开站和后台继续耦合**：`site-menu.js` 拆分、公开包不引入 admin 模块；加载矩阵审计继续守边界。
- **一次改太多**：严格按 Phase 顺序，每个阶段独立可部署、可回滚。
- **CSS 越改越乱**：公开站新建 `nav.css`，不往 `workspace-refresh.css` 上叠；后台复用 `tokens.css`/`components.css`。

## 12. 当前进度（本次已落地）

- **Phase 0 完成**：`/b/:id` 转义 + URL 协议校验（`sync.js`）、cron 无密钥时失败关闭、dev 脚本去掉 `--d1`、仪表盘乱码、删除死代码（`database-helper`、`auth-middleware`、`admin-router`、`token-enhanced.css`、`subpages.css`、旧 `public/js/home/*`）。
- **Phase 1 完成**：`db/schema.sql` 快照 + `db/migrations/0001_nav.mjs` + `scripts/migrate.mjs`（本地/远程、幂等、`schema_migrations`）；`nav_clicks`、`click_count`、排序/置顶/推荐/显隐字段；`/go/:id` 点击跳转并落库；首页卡片已改走 `/go`；`tests/migration.test.js` 用真实 SQLite 覆盖旧库升级。
- **Phase 2 完成**：`pages/functions/nav/render.js` 服务端渲染首页，`_middleware.js` 接管 `GET /`，带内容版本 + 代码版本的边缘缓存；新 `nav.css` / `nav.js`；`index.html` 改为静态兜底；`sitemap.xml` 用请求 origin，新增 `robots.txt`。图标按确认继续使用 Google s2（`bookmarks.favicon_url`）。
- **下一步（Phase 3）**：后台编辑排序/置顶/推荐/显隐/slug；站点设置（标题、描述、页脚、备案）；后台 9 页收敛；旧 `workspace-refresh.css` 与 admin CSS 清理；真实点击统计页替换假趋势图。

## 13. 本地验证

```bash
npm run db:init:local   # schema + migrations
npm run dev             # http://127.0.0.1:8788/
# 内容改动后首次查看可加 ?nocache=1 跳过边缘缓存
npm test                # 加载矩阵 + 89 个测试 + lint + prettier
```
