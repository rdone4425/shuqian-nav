# 书签导航首页设计稿

> Figma MCP 写入工具在本会话未暴露，无法直接创建远程 Figma 文件。本文件与同目录 SVG 作为 Figma 交付源：可将 `bookmark-nav-home-wireframe.svg` 导入 Figma 后按本规格拆分为组件和变量。

## 画板

- 桌面画板：`1440 x 1180`
- 移动适配参考：`390 x auto`
- 页面类型：应用型首页/个人书签工作台，不做营销落地页
- 核心首屏：顶部导航、搜索筛选工具条、分类快速筛选、书签目录

## 视觉方向

- 气质：清爽、轻量、日常工具感
- 背景：浅灰绿画布，使用非常轻的左右色彩洗底
- 色彩：深墨色为主操作，蓝/绿/珊瑚/琥珀/紫作为分类与状态点缀
- 容器：8px 圆角，低阴影，避免嵌套卡片
- 图片/视觉资产：使用真实站点 favicon 作为产品状态预览和书签卡片头像

## Tokens

| Token | Value | Usage |
| --- | --- | --- |
| `home.ink` | `#172033` | 标题、主按钮、深色预览面板 |
| `home.text` | `#46566d` | 正文、说明文字 |
| `home.muted` | `#7c8797` | 标签、辅助信息 |
| `home.canvas` | `#f3f5f0` | 页面背景 |
| `home.surface` | `#ffffff` | 卡片和工具条 |
| `home.line` | `#dce3df` | 边框 |
| `home.blue` | `#2764e7` | 主要强调、搜索聚焦 |
| `home.green` | `#0b8f66` | 工作台标识、分类点 |
| `home.coral` | `#d9563f` | 暖色强调 |
| `home.amber` | `#c98213` | 分类强调 |
| `home.plum` | `#884a91` | 品牌渐变 |

## 组件

- Header：64-68px 高，左侧品牌，右侧主搜索、菜单、登录/后台入口
- Search toolbar：搜索输入 + 搜索/清除按钮 + 分类/排序下拉 + 网格/列表切换 + 统计
- Category rail：横向 chip，彩色点表示分类
- Bookmark card：左侧 4px 分类色边，favicon 头像，标题、URL、描述、访问统计、分类标签
- Empty/error/loading：白色面板，轻虚线边框或轻边框

## 实现对应

- HTML：`public/index.html`
- 首页视觉：`public/css/workspace-refresh.css`
- 首页运行时文案：`public/js/home/i18n.js`
- 全站菜单：`public/components/header.html`、`public/js/shared/site-menu.js`

## Figma 导入建议

1. 在 Figma 中新建 Design 文件。
2. 导入 `docs/figma/bookmark-nav-home-wireframe.svg`。
3. 将颜色表转成变量，将按钮、chip、书签卡片拆成组件。
4. 对照 `public/index.html` 的 DOM 区块命名 frame：`Header`、`Toolbar`、`CategoryRail`、`Directory`。
