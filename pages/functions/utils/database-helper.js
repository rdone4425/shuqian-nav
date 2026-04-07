/**
 * 数据库操作辅助函数
 * 统一处理数据库操作，减少重复代码和提高错误处理
 */

export class DatabaseHelper {
  /**
   * 执行查询并返回所有结果
   */
  static async queryAll(db, sql, params = []) {
    try {
      const stmt = params.length > 0 
        ? db.prepare(sql).bind(...params)
        : db.prepare(sql);
      
      const result = await stmt.all();
      return result.results || [];
    } catch (error) {
      console.error('数据库查询错误:', error);
      throw new DatabaseError(`查询执行失败: ${error.message}`, error);
    }
  }

  /**
   * 执行查询并返回第一个结果
   */
  static async queryFirst(db, sql, params = []) {
    try {
      const stmt = params.length > 0 
        ? db.prepare(sql).bind(...params)
        : db.prepare(sql);
      
      return await stmt.first();
    } catch (error) {
      console.error('数据库查询错误:', error);
      throw new DatabaseError(`查询执行失败: ${error.message}`, error);
    }
  }

  /**
   * 执行更新/插入/删除操作
   */
  static async execute(db, sql, params = []) {
    try {
      const stmt = params.length > 0 
        ? db.prepare(sql).bind(...params)
        : db.prepare(sql);
      
      const result = await stmt.run();
      return {
        success: result.success || true,
        meta: result.meta || {},
        changes: result.changes || 0,
        lastRowId: result.meta?.last_row_id || null
      };
    } catch (error) {
      console.error('数据库执行错误:', error);
      throw new DatabaseError(`操作执行失败: ${error.message}`, error);
    }
  }

  /**
   * 批量执行操作（事务）
   */
  static async executeBatch(db, operations) {
    try {
      const statements = operations.map(op => {
        if (op.params && op.params.length > 0) {
          return db.prepare(op.sql).bind(...op.params);
        }
        return db.prepare(op.sql);
      });
      
      const results = await db.batch(statements);
      return results;
    } catch (error) {
      console.error('批量数据库操作错误:', error);
      throw new DatabaseError(`批量操作失败: ${error.message}`, error);
    }
  }

  /**
   * 检查记录是否存在
   */
  static async exists(db, table, condition, params = []) {
    const sql = `SELECT COUNT(*) as count FROM ${table} WHERE ${condition}`;
    const result = await this.queryFirst(db, sql, params);
    return (result?.count || 0) > 0;
  }

  /**
   * 获取记录总数
   */
  static async count(db, table, condition = '1=1', params = []) {
    const sql = `SELECT COUNT(*) as count FROM ${table} WHERE ${condition}`;
    const result = await this.queryFirst(db, sql, params);
    return result?.count || 0;
  }

  /**
   * 分页查询
   */
  static async paginate(db, sql, params = [], page = 1, limit = 10) {
    // 获取总数的SQL
    const countSql = this.buildCountSql(sql);
    const total = await this.queryFirst(db, countSql, params);
    const totalCount = total?.count || 0;
    
    // 计算分页
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(totalCount / limit);
    
    // 执行分页查询
    const paginatedSql = `${sql} LIMIT ${limit} OFFSET ${offset}`;
    const data = await this.queryAll(db, paginatedSql, params);
    
    return {
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * 插入记录并返回ID
   */
  static async insert(db, table, data) {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(data);
    
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    const result = await this.execute(db, sql, values);
    
    return result.lastRowId;
  }

  /**
   * 更新记录
   */
  static async update(db, table, data, condition, conditionParams = []) {
    const updates = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), ...conditionParams];
    
    const sql = `UPDATE ${table} SET ${updates} WHERE ${condition}`;
    return await this.execute(db, sql, values);
  }

  /**
   * 删除记录
   */
  static async delete(db, table, condition, params = []) {
    const sql = `DELETE FROM ${table} WHERE ${condition}`;
    return await this.execute(db, sql, params);
  }

  /**
   * 软删除记录（标记为已删除）
   */
  static async softDelete(db, table, id, deletedByField = 'deleted_by', deletedBy = 'system') {
    const data = {
      deleted_at: new Date().toISOString(),
      [deletedByField]: deletedBy
    };
    
    return await this.update(db, table, data, 'id = ?', [id]);
  }

  /**
   * 批量插入记录
   */
  static async batchInsert(db, table, records) {
    if (!records || records.length === 0) {
      return { success: true, insertedCount: 0 };
    }
    
    const columns = Object.keys(records[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    const operations = records.map(record => ({
      sql,
      params: Object.values(record)
    }));
    
    const results = await this.executeBatch(db, operations);
    return { 
      success: true, 
      insertedCount: results.length,
      results 
    };
  }

  /**
   * 获取表的最后更新时间
   */
  static async getLastUpdated(db, table, timestampColumn = 'updated_at') {
    const sql = `SELECT MAX(${timestampColumn}) as last_updated FROM ${table}`;
    const result = await this.queryFirst(db, sql);
    return result?.last_updated;
  }

  /**
   * 验证数据库连接
   */
  static async validateConnection(db) {
    try {
      await this.queryFirst(db, 'SELECT 1 as test');
      return { isValid: true };
    } catch (error) {
      return { 
        isValid: false, 
        error: error.message 
      };
    }
  }

  /**
   * 获取表结构信息
   */
  static async getTableInfo(db, tableName) {
    const sql = `PRAGMA table_info(${tableName})`;
    return await this.queryAll(db, sql);
  }

  /**
   * 检查表是否存在
   */
  static async tableExists(db, tableName) {
    const sql = "SELECT name FROM sqlite_master WHERE type='table' AND name=?";
    const result = await this.queryFirst(db, sql, [tableName]);
    return !!result;
  }

  /**
   * 构建计数SQL（用于分页）
   */
  static buildCountSql(sql) {
    // 简单的方法：将SELECT ... FROM替换为SELECT COUNT(*) FROM
    // 这是一个基础实现，复杂查询可能需要更精细的处理
    const fromIndex = sql.toLowerCase().indexOf('from');
    if (fromIndex === -1) {
      throw new Error('无效的SQL查询，缺少FROM子句');
    }
    
    const fromPart = sql.substring(fromIndex);
    // 移除ORDER BY子句（如果存在）
    const orderByIndex = fromPart.toLowerCase().lastIndexOf('order by');
    const cleanFromPart = orderByIndex > -1 ? fromPart.substring(0, orderByIndex) : fromPart;
    
    return `SELECT COUNT(*) as count ${cleanFromPart}`;
  }

  /**
   * 转义SQL标识符
   */
  static escapeIdentifier(identifier) {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  /**
   * 构建WHERE条件
   */
  static buildWhereCondition(filters) {
    if (!filters || Object.keys(filters).length === 0) {
      return { condition: '1=1', params: [] };
    }
    
    const conditions = [];
    const params = [];
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        conditions.push(`${this.escapeIdentifier(key)} = ?`);
        params.push(value);
      }
    });
    
    return {
      condition: conditions.length > 0 ? conditions.join(' AND ') : '1=1',
      params
    };
  }
}

/**
 * 自定义数据库错误类
 */
export class DatabaseError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}