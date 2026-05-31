import { authenticateRequest } from "../auth/verify.js";
import { insertDeletedBookmarksBatch } from "../../utils/deleted-bookmarks.js";

const CLEAR_ALL_CONFIRMATION = "CONFIRM_CLEAR_ALL_BOOKMARKS";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return jsonResponse(
        {
          success: false,
          error: "需要管理员权限",
        },
        401,
      );
    }

    const { confirmation = "" } = await request.json();
    if (confirmation !== CLEAR_ALL_CONFIRMATION) {
      return jsonResponse(
        {
          success: false,
          error: "清空全部书签需要二次确认，操作已取消。",
        },
        400,
      );
    }

    const result = await env.BOOKMARKS_DB.prepare(
      `
      SELECT
        b.id,
        b.title,
        b.url,
        b.description,
        b.favicon_url,
        b.created_at,
        b.updated_at,
        COALESCE(b.keep_status, 'normal') as keep_status,
        c.name as category_name
      FROM bookmarks b
      LEFT JOIN categories c ON b.category_id = c.id
      ORDER BY b.id ASC
    `,
    ).all();
    const bookmarks = result.results || [];

    if (bookmarks.length === 0) {
      return jsonResponse({
        success: true,
        data: {
          deleted: 0,
          archived: 0,
        },
        message: "当前没有可删除的书签。",
      });
    }

    const archiveResult = await insertDeletedBookmarksBatch(env, bookmarks, {
      deleteReason: "clear_all_bookmarks",
      deletedBy: "user",
    });

    if (archiveResult.errors > 0) {
      return jsonResponse(
        {
          success: false,
          error: "写入删除记录失败，已取消清空全部书签。",
          data: archiveResult,
        },
        500,
      );
    }

    await env.BOOKMARKS_DB.prepare("DELETE FROM bookmarks").run();

    return jsonResponse({
      success: true,
      data: {
        deleted: bookmarks.length,
        archived: archiveResult.inserted,
        skippedArchive: archiveResult.skipped,
      },
      message: `已删除 ${bookmarks.length} 个书签。`,
    });
  } catch (error) {
    console.error("清空全部书签失败:", error);
    return jsonResponse(
      {
        success: false,
        error: "清空全部书签失败",
        message: error.message,
      },
      500,
    );
  }
}
