#!/usr/bin/env node

/**
 * 配置生成脚本
 * 帮助用户快速生成个性化的配置文件
 */

const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function generateConfig() {
  console.log('🚀 书签导航项目配置生成器\n');
  
  // 获取用户输入
  const projectName = await ask('项目名称 (默认: bookmark-navigator): ') || 'bookmark-navigator';
  const dbName = await ask('数据库名称 (默认: bookmark-navigator-dev-db): ') || 'bookmark-navigator-dev-db';
  const adminPassword = await ask('管理员密码 (默认: admin123): ') || 'admin123';
  const jwtSecret = await ask('JWT密钥 (默认: 随机生成): ') || generateRandomSecret();
  
  console.log('\n📝 生成配置文件...\n');
  
  // 生成 wrangler.toml
  const wranglerConfig = `# ${projectName} 本地开发配置
# 注意：生产环境不使用此文件，在Cloudflare Pages控制台配置

name = "${projectName}"
compatibility_date = "2024-01-01"
pages_build_output_dir = "public"
compatibility_flags = ["nodejs_compat"]

# 本地开发数据库配置
[[d1_databases]]
binding = "BOOKMARKS_DB"
database_name = "${dbName}"
database_id = "your-database-id"  # 运行 npx wrangler d1 create ${dbName} 获取ID
`;

  // 生成 .dev.vars
  const devVars = `# ${projectName} 本地开发环境变量
ADMIN_PASSWORD=${adminPassword}
JWT_SECRET=${jwtSecret}
`;

  // 写入文件
  fs.writeFileSync('wrangler.toml', wranglerConfig);
  fs.writeFileSync('.dev.vars', devVars);
  
  console.log('✅ 配置文件生成完成！');
  console.log('\n📋 生成的文件:');
  console.log('   - wrangler.toml (本地开发配置)');
  console.log('   - .dev.vars (环境变量)');
  
  console.log('\n🔧 下一步操作:');
  console.log(`   1. 创建数据库: npx wrangler d1 create ${dbName}`);
  console.log('   2. 将返回的database_id更新到 wrangler.toml');
  console.log('   3. 运行: npm run setup');
  
  console.log('\n🌐 生产环境配置:');
  console.log('   在Cloudflare Pages控制台配置:');
  console.log(`   - 数据库绑定: BOOKMARKS_DB → ${dbName.replace('-dev', '')}`);
  console.log(`   - 环境变量: ADMIN_PASSWORD, JWT_SECRET`);
  
  rl.close();
}

function generateRandomSecret() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// 执行配置生成
if (require.main === module) {
  generateConfig().catch(error => {
    console.error('配置生成失败:', error);
    process.exit(1);
  });
}
