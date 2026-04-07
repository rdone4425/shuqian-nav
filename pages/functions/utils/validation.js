/**
 * 通用验证工具函数
 * 统一处理所有数据验证逻辑，减少重复代码
 */

export class Validator {
  /**
   * 验证书签数据
   */
  static validateBookmark(data) {
    const errors = [];
    
    // 标题验证
    if (!data.title?.trim()) {
      errors.push('标题不能为空');
    } else if (data.title.trim().length > 200) {
      errors.push('标题长度不能超过200个字符');
    }
    
    // URL验证
    if (!data.url?.trim()) {
      errors.push('URL不能为空');
    } else if (!this.isValidURL(data.url)) {
      errors.push('URL格式无效');
    }
    
    // 描述验证（可选）
    if (data.description && data.description.length > 500) {
      errors.push('描述长度不能超过500个字符');
    }
    
    // 分类ID验证（可选）
    if (data.category_id && !this.isPositiveInteger(data.category_id)) {
      errors.push('分类ID必须是正整数');
    }
    
    // 标签验证（可选）
    if (data.tags && typeof data.tags === 'string' && data.tags.length > 200) {
      errors.push('标签长度不能超过200个字符');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证分类数据
   */
  static validateCategory(data) {
    const errors = [];
    
    // 名称验证
    if (!data.name?.trim()) {
      errors.push('分类名称不能为空');
    } else if (data.name.trim().length > 50) {
      errors.push('分类名称长度不能超过50个字符');
    }
    
    // 颜色验证
    if (data.color && !this.isValidHexColor(data.color)) {
      errors.push('颜色格式无效，请使用十六进制颜色代码');
    }
    
    // 描述验证（可选）
    if (data.description && data.description.length > 200) {
      errors.push('描述长度不能超过200个字符');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证搜索参数
   */
  static validateSearchParams(params) {
    const errors = [];
    
    // 搜索词验证
    if (params.q && params.q.length > 100) {
      errors.push('搜索词长度不能超过100个字符');
    }
    
    // 分页验证
    if (params.page && !this.isPositiveInteger(params.page)) {
      errors.push('页码必须是正整数');
    }
    
    if (params.limit) {
      const limit = parseInt(params.limit);
      if (!this.isPositiveInteger(limit) || limit > 100) {
        errors.push('每页数量必须是1-100之间的整数');
      }
    }
    
    // 排序验证
    const validSortFields = ['title', 'created_at', 'updated_at', 'visit_count', 'last_visited', 'popularity_score'];
    const validSortDirections = ['asc', 'desc'];
    
    if (params.sort && !validSortFields.includes(params.sort)) {
      errors.push(`排序字段无效，支持的字段：${validSortFields.join(', ')}`);
    }
    
    if (params.order && !validSortDirections.includes(params.order.toLowerCase())) {
      errors.push('排序方向只能是 asc 或 desc');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证分页参数
   */
  static validatePagination(params) {
    const errors = [];
    const page = parseInt(params.page) || 1;
    const limit = parseInt(params.limit) || 10;
    
    if (page < 1) {
      errors.push('页码必须大于0');
    }
    
    if (limit < 1 || limit > 100) {
      errors.push('每页数量必须在1-100之间');
    }

    return {
      isValid: errors.length === 0,
      errors,
      page,
      limit,
      offset: (page - 1) * limit
    };
  }

  /**
   * 验证ID参数
   */
  static validateId(id, name = 'ID') {
    const errors = [];
    
    if (!id) {
      errors.push(`${name}不能为空`);
    } else if (!this.isPositiveInteger(id)) {
      errors.push(`${name}必须是正整数`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      id: parseInt(id)
    };
  }

  /**
   * 验证配置数据
   */
  static validateConfig(data) {
    const errors = [];
    
    // 配置键验证
    if (!data.config_key?.trim()) {
      errors.push('配置键不能为空');
    } else if (data.config_key.length > 100) {
      errors.push('配置键长度不能超过100个字符');
    }
    
    // 配置值验证
    if (data.config_value && data.config_value.length > 1000) {
      errors.push('配置值长度不能超过1000个字符');
    }
    
    // 描述验证（可选）
    if (data.description && data.description.length > 200) {
      errors.push('描述长度不能超过200个字符');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证URL格式
   */
  static isValidURL(url) {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  /**
   * 验证十六进制颜色代码
   */
  static isValidHexColor(color) {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  /**
   * 验证是否为正整数
   */
  static isPositiveInteger(value) {
    const num = parseInt(value);
    return Number.isInteger(num) && num > 0;
  }

  /**
   * 验证邮箱格式
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 验证密码强度
   */
  static validatePassword(password) {
    const errors = [];
    
    if (!password) {
      errors.push('密码不能为空');
      return { isValid: false, errors };
    }
    
    if (password.length < 6) {
      errors.push('密码长度至少6位');
    }
    
    if (password.length > 50) {
      errors.push('密码长度不能超过50位');
    }
    
    // 可以根据需要添加更多密码强度验证
    // if (!/(?=.*[a-z])/.test(password)) {
    //   errors.push('密码必须包含小写字母');
    // }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 清理和标准化字符串
   */
  static sanitizeString(str, maxLength = null) {
    if (typeof str !== 'string') return '';
    
    let cleaned = str.trim();
    
    if (maxLength && cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength);
    }
    
    return cleaned;
  }

  /**
   * 清理和验证数字
   */
  static sanitizeNumber(value, min = null, max = null, defaultValue = null) {
    const num = parseInt(value);
    
    if (isNaN(num)) {
      return defaultValue;
    }
    
    if (min !== null && num < min) {
      return min;
    }
    
    if (max !== null && num > max) {
      return max;
    }
    
    return num;
  }

  /**
   * 批量验证
   */
  static validateBatch(validations) {
    const allErrors = [];
    let isValid = true;
    
    for (const validation of validations) {
      if (!validation.isValid) {
        isValid = false;
        allErrors.push(...validation.errors);
      }
    }
    
    return {
      isValid,
      errors: allErrors
    };
  }
}