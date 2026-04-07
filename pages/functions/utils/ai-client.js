/**
 * Generic AI client for calling external LLM providers (default: OpenAI compatible)
 */

export class AIClient {
  static ensureConfig(env) {
    if (!env.AI_API_KEY) {
      throw new Error("AI_API_KEY 未配置，无法调用 AI 接口");
    }
  }

  static normalize(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  static getEndpoint(env, overrides = {}) {
    return (
      this.normalize(overrides.ai_api_endpoint) ||
      this.normalize(env.AI_API_ENDPOINT) ||
      "https://api.openai.com/v1/chat/completions"
    );
  }

  static getModel(env, overrides = {}) {
    return (
      this.normalize(overrides.ai_model) ||
      this.normalize(env.AI_MODEL) ||
      "gpt-4o-mini"
    );
  }

  static async loadOverrides(env) {
    if (!env?.BOOKMARKS_DB?.prepare) {
      return {};
    }

    try {
      const result = await env.BOOKMARKS_DB.prepare(
        `
        SELECT config_key, config_value
        FROM system_config
        WHERE config_key IN ('ai_api_endpoint', 'ai_model')
      `,
      ).all();

      const overrides = {};
      (result?.results || []).forEach((row) => {
        overrides[row.config_key] = row.config_value || "";
      });
      return overrides;
    } catch (error) {
      console.warn("获取 AI 配置覆盖参数失败", error);
      return {};
    }
  }

  static buildHeaders(env) {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.AI_API_KEY}`,
    };

    if (env.AI_API_ORG) {
      headers["OpenAI-Organization"] = env.AI_API_ORG;
    }

    return headers;
  }

  static async chatCompletion({
    env,
    messages,
    response_format,
    temperature = 0.3,
    max_tokens = 1200,
  }) {
    this.ensureConfig(env);

    const overrides = await this.loadOverrides(env);
    const endpoint = this.getEndpoint(env, overrides);
    const model = this.getModel(env, overrides);

    const payload = {
      model,
      messages,
      temperature,
      max_tokens,
    };

    if (response_format) {
      payload.response_format = response_format;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: this.buildHeaders(env),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `AI 接口调用失败: ${response.status} ${response.statusText} - ${text}`,
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("AI 接口未返回内容");
    }

    return content;
  }
}
