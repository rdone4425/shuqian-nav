/**
 * API响应工具函数
 * 统一处理所有API响应格式，减少重复代码
 */

export class ResponseHelper {
  /**
   * 成功响应
   */
  static success(data = null, message = null, status = 200) {
    const responseData = {
      success: true,
      timestamp: new Date().toISOString()
    };

    if (data !== null) responseData.data = data;
    if (message) responseData.message = message;

    return new Response(JSON.stringify(responseData), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * 错误响应
   */
  static error(error, status = 500, details = null) {
    const errorMessage = typeof error === 'string' ? error : error.message;
    console.error('API错误:', errorMessage, details || '');
    
    const responseData = {
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    };

    if (details) responseData.details = details;

    return new Response(JSON.stringify(responseData), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * 验证错误响应 (400)
   */
  static validationError(errors, message = '请求参数无效') {
    const responseData = {
      success: false,
      error: message,
      errors: Array.isArray(errors) ? errors : [errors],
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(responseData), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * 认证错误响应 (401)
   */
  static unauthorized(message = '需要认证') {
    return this.error(message, 401);
  }

  /**
   * 权限错误响应 (403)
   */
  static forbidden(message = '权限不足') {
    return this.error(message, 403);
  }

  /**
   * 资源不存在响应 (404)
   */
  static notFound(message = '资源不存在') {
    return this.error(message, 404);
  }

  /**
   * 服务器错误响应 (500)
   */
  static serverError(error = '服务器内部错误', details = null) {
    return this.error(error, 500, details);
  }

  /**
   * 数据库错误响应
   */
  static databaseError(error = '数据库操作失败') {
    return this.error(error, 500);
  }

  /**
   * 业务逻辑错误响应 (422)
   */
  static businessError(message = '业务逻辑错误') {
    return this.error(message, 422);
  }

  /**
   * 分页响应
   */
  static paginated(data, pagination, message = null) {
    const responseData = {
      success: true,
      data,
      pagination: {
        page: parseInt(pagination.page) || 1,
        limit: parseInt(pagination.limit) || 10,
        total: parseInt(pagination.total) || 0,
        totalPages: Math.ceil(pagination.total / pagination.limit) || 1
      },
      timestamp: new Date().toISOString()
    };

    if (message) responseData.message = message;

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * 重定向响应
   */
  static redirect(url, permanent = false) {
    return new Response(null, {
      status: permanent ? 301 : 302,
      headers: { Location: url }
    });
  }

  /**
   * 文件下载响应
   */
  static download(data, filename, contentType = 'application/octet-stream') {
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  }

  /**
   * CORS预检响应
   */
  static cors(allowMethods = ['GET', 'POST', 'PUT', 'DELETE'], allowHeaders = ['Content-Type', 'Authorization']) {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': allowMethods.join(', '),
        'Access-Control-Allow-Headers': allowHeaders.join(', '),
        'Access-Control-Max-Age': '86400'
      }
    });
  }
}