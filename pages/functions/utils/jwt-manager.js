// JWT密钥管理工具
export class JWTKeyManager {
  
  // 生成安全的JWT密钥
  static generateJWTSecret() {
    // 使用crypto API生成32字节的随机密钥
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    
    // 转换为base64字符串
    return btoa(String.fromCharCode(...array));
  }

  // 获取JWT密钥（优先级：环境变量 > 数据库 > 自动生成）
  static async getJWTSecret(env) {
    // 1. 优先使用环境变量
    if (env.JWT_SECRET) {
      return env.JWT_SECRET;
    }

    // 2. 尝试从数据库读取
    try {
      const result = await env.BOOKMARKS_DB
        .prepare('SELECT config_value FROM system_config WHERE config_key = ?')
        .bind('jwt_secret')
        .first();

      if (result?.config_value) {
        return result.config_value;
      }
    } catch (error) {
      console.error('从数据库读取JWT密钥失败:', error);
    }

    // 3. 自动生成并保存到数据库
    const newSecret = this.generateJWTSecret();
    
    try {
      await env.BOOKMARKS_DB
        .prepare('INSERT OR REPLACE INTO system_config (config_key, config_value, description, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
        .bind('jwt_secret', newSecret, 'JWT密钥（自动生成）')
        .run();

      console.log('✅ JWT密钥已自动生成并保存到数据库');
      return newSecret;
    } catch (error) {
      console.error('保存JWT密钥失败:', error);
      // 如果数据库保存失败，使用临时密钥
      console.warn('⚠️ 使用临时JWT密钥，请检查数据库配置');
      return newSecret;
    }
  }

  // 重新生成JWT密钥（用于安全维护）
  static async regenerateJWTSecret(env) {
    const newSecret = this.generateJWTSecret();
    
    try {
      await env.BOOKMARKS_DB
        .prepare('UPDATE system_config SET config_value = ?, updated_at = CURRENT_TIMESTAMP WHERE config_key = ?')
        .bind(newSecret, 'jwt_secret')
        .run();

      return { success: true, secret: newSecret };
    } catch (error) {
      console.error('重新生成JWT密钥失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 检查JWT密钥是否安全
  static isSecretSecure(secret) {
    if (!secret) return false;
    if (secret.length < 32) return false;
    if (secret === 'default-secret-key') return false;
    
    // 检查是否是常见的不安全密钥
    const unsafeSecrets = [
      'secret', 'jwt-secret', 'your-secret-key', 'changeme',
      'admin', 'password', '123456', 'test-secret'
    ];
    
    return !unsafeSecrets.includes(secret.toLowerCase());
  }
}