# 📚 书签导航

现代化书签管理系统，基于 Cloudflare Pages + Functions + D1 数据库。

## ✨ 特性

- 🔐 JWT认证保护
- 📚 书签增删改查
- 🔍 智能搜索排序
- 📱 响应式设计
- 🚀 无服务器架构
- 🔗 链接检查器 - 自动检查和清理无效链接
- 🔔 定时通知 - 每周自动检查，智能删除失效书签
- 🔄 Chrome插件同步 - 支持Chrome书签自动同步
- 🔑 API令牌管理 - 安全的API访问控制

## 📦 项目结构

```
nav/
├── functions/                 # Cloudflare Pages Functions
│   ├── _middleware.js        # 全局中间件（CORS）
│   ├── api/                  # API端点
│   └── utils/                # 工具库
├── public/                   # 静态文件
│   ├── index.html           # 主页面
│   ├── css/                 # 样式文件
│   └── js/                  # JavaScript模块
├── chrome/                  # Chrome插件
├── scripts/                 # 工具脚本
├── wrangler.toml           # Cloudflare配置
└── package.json            # 项目依赖
```

## 🚀 快速部署

### ⚡ 零配置部署（推荐）

1. **Fork或下载本项目**到你的仓库
2. **连接到 Cloudflare Pages**：
   - 访问 [Cloudflare Pages](https://pages.cloudflare.com/)
   - 点击"创建项目" → "连接到Git" 
   - 选择你的仓库
   - 部署设置保持默认即可
3. **等待部署完成**，访问你的网站
4. **首次访问**会自动跳转到密码设置页面
5. **设置强密码**，立即开始使用！

系统会自动：
- 🔐 生成安全的JWT密钥并存储到数据库
- 🛡️ 强制设置强密码（禁用默认密码）
- 📊 初始化数据库结构

### 🔧 手动部署（高级用户）

如果需要自定义配置：

```bash
# 1. 安装依赖
npm install

# 2. 安装Wrangler CLI
npm install -g wrangler

# 3. 登录Cloudflare
wrangler auth login

# 4. 创建Pages项目
wrangler pages project create bookmark-navigator

# 5. 创建D1数据库
wrangler d1 create bookmarks-db

# 6. 更新wrangler.toml中的database_id

# 7. 部署
npm run deploy
```

## 🔒 安全配置

### JWT密钥管理
- 系统启动时自动生成256位安全密钥
- 密钥存储在D1数据库中，确保安全性
- 支持密钥轮换和更新

### 密码安全
- 强制使用强密码（最少8位，包含字母数字特殊字符）
- 禁用默认密码`admin123`，强制首次设置
- 支持密码修改和重置

### API访问控制
- JWT令牌认证，确保API安全
- 支持令牌生成、刷新和撤销
- 细粒度的权限控制

## 🔄 Chrome插件同步

### 安装Chrome插件

1. **加载插件**：
   - 打开 `chrome://extensions/`
   - 开启"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目中的 `chrome/` 文件夹

2. **配置插件**：
   - 点击插件图标 → 设置
   - 配置服务器地址（你的网站URL）
   - 输入API令牌（从网站令牌管理获取）
   - 测试连接并保存

3. **同步书签**：
   - 点击"开始同步"即可

### API令牌获取
1. 登录书签导航网站
2. 点击顶部🔑图标进入令牌管理
3. 生成新的API令牌
4. 复制到Chrome插件配置中

## 🛠️ 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 创建环境变量文件 .dev.vars
ADMIN_PASSWORD=your-password
JWT_SECRET=your-secret-key

# 3. 启动开发服务器
npm run dev

# 4. 访问 http://localhost:8788
```

## 🧰 核心功能

### 书签管理
- ✅ 增删改查书签
- ✅ 分类管理
- ✅ 搜索和排序
- ✅ 批量操作

### 链接检查
- ✅ 自动检查无效链接
- ✅ 智能清理失效书签
- ✅ 定时任务支持

### 数据管理
- ✅ 导入/导出功能
- ✅ 数据备份
- ✅ 数据库优化

## 🔧 API接口

### 认证接口
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/setup-password` - 设置密码
- `POST /api/auth/change-password` - 修改密码

### 书签接口
- `GET /api/bookmarks` - 获取书签列表
- `POST /api/bookmarks` - 创建书签
- `PUT /api/bookmarks/[id]` - 更新书签
- `DELETE /api/bookmarks/[id]` - 删除书签

### 系统接口
- `GET /api/health` - 健康检查
- `GET /api/system/diagnose` - 系统诊断
- `POST /api/system/backup` - 数据备份

## 📝 更新日志

### v2.0.0
- ✅ 零配置部署支持
- ✅ 自动JWT密钥生成
- ✅ 强制密码安全设置
- ✅ Chrome插件同步
- ✅ 代码重构优化
- ✅ 统一工具库
- ✅ 响应式设计升级

### v1.0.0
- ✅ 基础书签管理功能
- ✅ JWT认证系统
- ✅ 数据库自动初始化
- ✅ 链接检查器
- ✅ 导入导出功能

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

💡 **提示**: 这是一个完全开源的项目，您可以自由使用、修改和分发。如果遇到问题，请查看项目的 Issues 页面或创建新的 Issue。