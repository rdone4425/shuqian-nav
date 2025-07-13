# Cloudflare Pages 部署配置指南

## 部署设置

### 构建配置

在 Cloudflare Pages Dashboard 中手动配置以下设置：

- **构建命令**: `npm install`
- **输出目录**: `public`
- **Root目录**: `/` (默认)
- **Node.js版本**: 18 (会自动读取 `.nvmrc` 文件)

### 环境变量

需要在 Cloudflare Dashboard 中配置以下环境变量：

```
ENVIRONMENT=production
```

### D1 数据库绑定

在 Settings > Functions 中添加 D1 数据库绑定：

- **变量名**: `BOOKMARKS_DB`
- **数据库**: 选择你的 D1 数据库实例

## 部署步骤

1. **连接 GitHub 仓库**
   - 在 Cloudflare Pages 中连接你的 GitHub 仓库
   - 选择要部署的分支 (通常是 `main`)

2. **配置构建设置**
   ```
   构建命令: npm install
   输出目录: public
   ```

3. **配置环境变量和绑定**
   - 添加必要的环境变量
   - 绑定 D1 数据库

4. **部署**
   - 点击 "Save and Deploy"
   - 等待部署完成

## 故障排除

### jose 依赖错误

如果遇到 `Could not resolve "jose"` 错误：

1. 确保构建命令设置为 `npm install`
2. 检查 `package.json` 中是否包含 `jose` 依赖
3. 确保 Node.js 版本设置正确

### Functions 不工作

如果 API 端点不响应：

1. 检查 D1 数据库绑定是否正确
2. 确认环境变量配置
3. 查看 Functions 日志获取详细错误信息

## 文件结构

```
nav/
├── public/                 # 静态文件目录 (输出目录)
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── _headers           # HTTP 头部配置
├── functions/             # Cloudflare Pages Functions
│   └── api/
├── package.json           # 依赖配置
├── .nvmrc                # Node.js 版本
└── README.md
```

## 重要注意事项

- ❌ **不需要** `wrangler.toml` 文件
- ✅ **需要** 在 Dashboard 中手动配置构建设置
- ✅ **保留** `_headers` 文件用于 HTTP 头部配置
- ✅ **保留** `.nvmrc` 文件指定 Node.js 版本

## 成功部署检查清单

- [ ] 构建命令设置为 `npm install`
- [ ] 输出目录设置为 `public`
- [ ] D1 数据库正确绑定
- [ ] 环境变量已配置
- [ ] 部署成功无错误
- [ ] API 端点正常响应
- [ ] 前端页面正常加载