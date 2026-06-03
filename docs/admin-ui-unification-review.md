# 后台 UI 统一方案 —— 对抗式评审修正(执行前必读)

> 配套文档:[admin-ui-unification-plan.md](./admin-ui-unification-plan.md)
> 本文件汇总两个评审 agent(roadmap-alignment / design-completeness)发现的问题。
> **标记 🔴 的是执行前必须先解决的硬伤,否则会连带搞坏公开首页或在 9 个页面同时崩。**

## 🔴 必须先修正(high severity)

1. **首页破坏向量 —— `.btn`/`.modal`/`.form-*` 只能"复制",不能"移动"。**
   - 原方案说把这些规则从 `styles.css` **移到** `components.css`,并让 `styles.css`"只给首页用"。
   - 但 `index.html` 仍加载 `styles.css` 且用了真实的 `.btn .btn-primary`(重试按钮)。`workspace-refresh.css` 只覆盖颜色/边框,**不提供 padding/display/font-size**。移走后首页按钮会塌掉。
   - **改为:把 `.btn*`/`.modal*`/`.form-*` 复制进 `components.css`,`styles.css` 原样保留、首页继续加载。** §3 "Collapse map" 里 `styles.css` 那行从"moved into"改成"copied into; styles.css left byte-intact"。

2. **验证手段被高估 —— CSS 正确性 100% 靠截图,不是靠 `npm test`。**
   - `npm test` 实际只跑 `audit-loading-matrix.mjs`(+ node --test + lint + format),**不含** `audit-buttons.mjs`;CSS 根本不被 lint/format。
   - `audit-loading-matrix.mjs` 的 CSS 检查只断言 href 含 `?v=nav-` 前缀,且**显式排除 `styles.css`**;不校验链接了哪些表、`?v=` 是否真的变了、class 覆盖。
   - **行动:`scripts/screenshot-admin.mjs` 目前不存在,必须先建好(需认证会话),并且要把 `index.html`(公开首页)也纳入 before/after 截图。改任何 CSS 前先抓基线截图(roadmap 第 228 行也要求先记录当前截图)。**

3. **`management.css` 的 alias 清单不完整 —— 直接删会让"最干净"的试点页当场崩。**
   - 方案称 `bookmarks-manage` / `admin-settings` / `categories` 的 markup"已 100% 用共享类",但它们实际引用了约 **23 个** `management-*`/相关类,§2.3 只列了约 5 个 alias。
   - 未覆盖的至少有:`management-shell, management-toolbar, management-form, management-form-heading, management-fields, management-actions, management-summary, management-table, management-table-wrap, management-select, management-empty, management-pagination, row-title, row-url, summary-metric, category-summary-grid, section-action-stack, selection-note, danger-text, inline-actions, color-swatch, category-pill`。
   - **行动:删 `management.css` 前,grep 全部 9 个页面的 HTML+JS,把每一个被消费的选择器都在 `components.css` 里 alias 或重命名。把"merge management.css"理解为"逐个 port + alias",不是笼统合并。**

4. **Toast 变体缺失 —— `success`/`info` 会渲染成深灰而不是绿色。**
   - `management.css` 的 toast 只有 base + `.error` + `.warning`,base 背景是深灰(`--wr-ink`)。`success` toast(被 bookmark-manager / admin-settings / deleted-bookmarks 等发出)会显示成深灰;`import.js` 还会发 `info` 类型。
   - tokens 里定义了 `--c-success`/`--c-info` 却没有组件消费 → 自相矛盾。
   - **行动:在 `components.css` 显式加 `.message-toast.success`(用 `--c-success`)和 `.message-toast.info`,或明确文档化"success/info 故意用中性深色"。并决定 `import.js` 的 `info` 映射到什么。**

## 🟠 应处理(medium)

5. **试点页依赖最危险的 token 切换先发生。** `bookmarks-manage` 现在能正确渲染,是因为它同时加载了 `workspace-refresh.css`(提供 `management.css` 消费的 `--wr-*`)。试点一次性丢掉 `styles+workspace-refresh+management`,任何一个 `--wr-*` 没 re-point 就会让"基线页"的表格/toast 失去边框/阴影。
   - **行动:试点 link-swap 前,grep `components.css` 不得残留 `--wr-`/`--admin-`/`--primary-color`/`--font-size-`(应为 0 命中),作为 §5 step3 的硬门禁。考虑把试点拆成"先 additive 加新表、旧表仍在 → 证明 components.css 能渲染 → 第二次 commit 再删旧表"两步。**

6. **`.modal` 首页/后台是否分叉要明确决定。** `styles.css` 的 `.modal`(带 blur、深 `rgba(0,0,0,.45)` 遮罩)与 `management.css` 的 `.management-modal`(`rgba(15,23,42,.42)`、无 blur)外观不同。两者都折叠进 `components.css` 的 `.modal` 后,首页(仍用 styles.css)和后台(用 components.css)同名 `.modal` 会长得不一样。
   - **行动:明确是共享还是故意分叉,并写进文档。**

7. **试点分页 markup 会变。** `bookmark-manager-page.js` 用 `.management-pagination` + `.btn.btn-secondary` 平铺;§2.3 想换成 40×40 的 `.pagination` 部件 → 这会改变"零偏差试点页"的外观。
   - **行动:试点阶段先把 `.management-pagination` alias 成现有平铺行为,保持基线不变;40×40 部件延后到单独截图验证的步骤。先确认到底哪个页面真的发出 `.page-btn`(notifications-page.js 里没有)。**

## 🟡 事实更正(执行时按这个为准)

8. **`.btn-sm` vs `.btn-small` 是命名漂移,不是"完全没定义"。** `deleted-bookmarks.js` 发出 `.btn-sm`,但 CSS 里只有 `.btn-small`(定义在 token/notifications-enhanced)。结论(在 components.css 定义 `.btn-sm`)对,但要顺手统一 `.btn-small`/`.btn-sm` 两个名字。
9. **`.btn-warning` 其实已定义**(token-enhanced:400、notifications-enhanced:531),且 **grep 没找到任何 JS/HTML 发出它** → 可能是死代码。**别盲目新增**(违反"无投机代码原则");先确认有没有使用方。
10. **`subpages.css` 的 `.sp-*` 是死代码**(没有任何 HTML 链接它)。作为"干净来源"参考可以,但它**当前不在屏幕上渲染**,所以"最干净"是代码质量判断,不是现状描述。`.data-list` 网格第一次承载真实内容会发生在最高风险的 link-checker/deleted-bookmarks 上,需额外截图审视。
11. **`.modal-close` 不在 confirm 弹窗契约里。** `AdminUI.confirm` 的关闭按钮硬编码为 `class="btn btn-secondary"`(admin-common.js:115),不是 `.modal-close`。`.modal-close` 只属于页面级弹窗(categories/restore)。confirm 弹窗的结构契约是:`.modal/.modal-content/.modal-header/.modal-body/.modal-actions/.admin-confirm-dialog/.form-group/.form-input/.form-help/.btn/.btn-danger/.btn-primary/.btn-secondary/.hidden`。
12. **方案反复引用的"CSS audit 文件"在 repo 里不存在**(只有 audit-buttons.mjs / audit-loading-matrix.mjs)。定量断言(~260 行重复、5 份 `@keyframes spin` 等)应改述为"由 grep 验证"并给可复现命令;定性结论(5 套 `.btn`、多份 `:root`、死的 `.sp-*`)经抽查为真,成立。

## 🔵 计划里缺失、需补上的步骤

- **首页 `index.html` 与 `login.html` 的 before/after 截图**(两者都共享 `styles.css`/`workspace-refresh.css`,是最大盲区)。
- **Step 0:先对"未迁移的当前页面"建好并冒烟测试截图脚本,抓到真实基线**,否则"逐页 diff"没有 diff 对象。
- **共享层回滚预案**:给"components.css 锁定到试点基线"的那次 commit 打 tag,以便多页迁移后若发现 `components.css` 有 bug 能恢复到已知良好状态。
- **校验每个改动页面的 `?v=` 真的变了**(审计只查前缀存在,不查是否改变;无构建的线上站会因此发旧缓存——roadmap 第 277 行点名的风险)。
- **JS class 重命名要逐页即时 grep**("任何 JS/HTML 里的 class 都要有 CSS 归宿"),不要只在最后做。

## 综合裁决

两个评审都认为方案**方向正确、与 roadmap 强一致**,核心修复(建 tokens/base/components、统一 token、删 enhanced、试点 bookmarks-manage)成立。但执行前必须先落实 #1–#4(尤其是"复制而非移动 styles.css"和"先建截图基线含首页"),否则会连带破坏公开首页且无自动化手段发现。
