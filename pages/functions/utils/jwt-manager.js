let cachedJwtSecret = null;

export class JWTKeyManager {
  static generateJWTSecret() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes));
  }

  static hasDatabaseBinding(env) {
    return typeof env?.BOOKMARKS_DB?.prepare === "function";
  }

  static async getJWTSecret(env) {
    if (env?.JWT_SECRET) {
      return env.JWT_SECRET;
    }

    if (cachedJwtSecret) {
      return cachedJwtSecret;
    }

    if (this.hasDatabaseBinding(env)) {
      try {
        const result = await env.BOOKMARKS_DB.prepare(
          "SELECT config_value FROM system_config WHERE config_key = ?",
        )
          .bind("jwt_secret")
          .first();

        if (result?.config_value) {
          cachedJwtSecret = result.config_value;
          return cachedJwtSecret;
        }
      } catch (error) {
        console.error("Failed to read JWT secret from D1:", error);
      }
    }

    cachedJwtSecret = this.generateJWTSecret();

    if (this.hasDatabaseBinding(env)) {
      try {
        await env.BOOKMARKS_DB.prepare(
          "INSERT OR REPLACE INTO system_config (config_key, config_value, description, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
        )
          .bind("jwt_secret", cachedJwtSecret, "Auto-generated JWT secret")
          .run();
      } catch (error) {
        console.error("Failed to persist JWT secret to D1:", error);
        console.warn(
          "Using an in-memory JWT secret because D1 is unavailable. Set JWT_SECRET for stable authentication across cold starts.",
        );
      }
    } else {
      console.warn(
        "BOOKMARKS_DB binding is missing. Using an in-memory JWT secret. Set JWT_SECRET for stable authentication across cold starts.",
      );
    }

    return cachedJwtSecret;
  }

  static async regenerateJWTSecret(env) {
    const newSecret = this.generateJWTSecret();

    if (!this.hasDatabaseBinding(env)) {
      cachedJwtSecret = newSecret;
      return {
        success: true,
        secret: newSecret,
        source: "memory",
      };
    }

    try {
      await env.BOOKMARKS_DB.prepare(
        "UPDATE system_config SET config_value = ?, updated_at = CURRENT_TIMESTAMP WHERE config_key = ?",
      )
        .bind(newSecret, "jwt_secret")
        .run();

      cachedJwtSecret = newSecret;
      return { success: true, secret: newSecret, source: "database" };
    } catch (error) {
      console.error("Failed to regenerate JWT secret:", error);
      return { success: false, error: error.message };
    }
  }

  static isSecretSecure(secret) {
    if (!secret) return false;
    if (secret.length < 32) return false;
    if (secret === "default-secret-key") return false;

    const unsafeSecrets = [
      "secret",
      "jwt-secret",
      "your-secret-key",
      "changeme",
      "admin",
      "password",
      "123456",
      "test-secret",
    ];

    return !unsafeSecrets.includes(secret.toLowerCase());
  }
}
