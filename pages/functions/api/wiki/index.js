import { authenticateRequest } from '../auth/verify.js';
import { ResponseHelper } from '../../utils/response-helper.js';
import { AIWikiGenerator } from '../../utils/ai-wiki.js';

const SNAPSHOT_KEY = 'wiki_ai_snapshot';

async function fetchSnapshot(env) {
  const row = await env.BOOKMARKS_DB.prepare(
    'SELECT config_value FROM system_config WHERE config_key = ?'
  ).bind(SNAPSHOT_KEY).first();

  if (!row?.config_value) {
    return null;
  }

  try {
    return JSON.parse(row.config_value);
  } catch {
    return null;
  }
}

async function saveSnapshot(env, snapshot) {
  await env.BOOKMARKS_DB.prepare(`
    INSERT INTO system_config (config_key, config_value, description, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(config_key) DO UPDATE SET
      config_value = excluded.config_value,
      description = excluded.description,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    SNAPSHOT_KEY,
    JSON.stringify(snapshot),
    'AI 自动整理的 Wiki Snapshot'
  ).run();
}

async function loadAllBookmarks(env) {
  const result = await env.BOOKMARKS_DB.prepare(`
    SELECT 
      b.id,
      b.title,
      b.url,
      b.description,
      b.favicon_url,
      b.category_id,
      c.name as category_name,
      c.color as category_color,
      COALESCE(b.visit_count, 0) as visit_count,
      b.last_visited,
      b.created_at,
      b.updated_at
    FROM bookmarks b
    LEFT JOIN categories c ON b.category_id = c.id
    ORDER BY b.created_at DESC
  `).all();

  return result?.results || [];
}

export async function onRequestGet(context) {
  const snapshot = await fetchSnapshot(context.env);
  return ResponseHelper.success({
    snapshot,
    available: Boolean(snapshot)
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const auth = await authenticateRequest(request, env);
  if (!auth.authenticated) {
    return ResponseHelper.unauthorized(auth.error);
  }

  try {
    const bookmarks = await loadAllBookmarks(env);
    if (!bookmarks.length) {
      return ResponseHelper.validationError('还没有书签，无法生成 Wiki');
    }

    const snapshot = await AIWikiGenerator.generate(bookmarks, env);
    await saveSnapshot(env, snapshot);

    return ResponseHelper.success(snapshot, 'AI Wiki 生成完成');
  } catch (error) {
    console.error('AI Wiki 生成失败:', error);
    return ResponseHelper.serverError('AI 生成失败', error.message);
  }
}
