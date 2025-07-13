/**
 * 认证中间件
 * 统一处理API认证逻辑，减少重复代码
 */
import { authenticateRequest } from '../api/auth/verify.js';
import { ResponseHelper } from './response-helper.js';

export class AuthMiddleware {
  /**
   * 验证请求认证
   * @param {Request} request - 请求对象
   * @param {Object} env - 环境变量
   * @param {boolean} required - 是否必需认证，默认true
   * @returns {Object} 认证结果
   */
  static async authenticate(request, env, required = true) {
    try {
      const auth = await authenticateRequest(request, env);
      
      if (required && !auth.authenticated) {
        return {
          success: false,
          response: ResponseHelper.unauthorized(auth.error)
        };
      }
      
      return {
        success: true,
        auth,
        user: auth.user || null
      };
    } catch (error) {
      return {
        success: false,
        response: ResponseHelper.serverError('认证验证失败', error.message)
      };
    }
  }

  /**
   * 认证装饰器函数
   * 用于包装需要认证的API端点
   */
  static withAuth(handler, required = true) {
    return async (context) => {
      const { request, env } = context;
      
      const authResult = await this.authenticate(request, env, required);
      
      if (!authResult.success) {
        return authResult.response;
      }
      
      // 将认证信息添加到context中
      context.auth = authResult.auth;
      context.user = authResult.user;
      
      return await handler(context);
    };
  }

  /**
   * 可选认证装饰器
   * 认证失败时不会阻止请求继续
   */
  static withOptionalAuth(handler) {
    return this.withAuth(handler, false);
  }
}