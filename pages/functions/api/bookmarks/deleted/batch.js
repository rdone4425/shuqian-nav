import { authenticateRequest } from "../../auth/verify.js";
import { ResponseHelper } from "../../../utils/response-helper.js";
import { recordAuditLog } from "../../system/audit-logs.js";

const MAX_IDS = 500;

function getDeletedRangeStart(range) {
  if (!range || range === "all") {
    return null;
  }

  const now = new Date();
  if (range === "today") {
    return toSqlTimestamp(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  const daysByRange = { "7d": 7, "30d": 30 };
  const days = daysByRange[range];
  if (!days) {
    return null;
  }
  return toSqlTimestamp(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function toSqlTimestamp(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 19).replace("T", " ");
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
      return ResponseHelper.unauthorized(auth.error);
    }

    const body = await request.json().catch(() => ({}));
    const ids = [...new Set(Array.isArray(body.ids) ? body.ids : [])]
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
    const selectAll = Boolean(body.all);

    if (!selectAll && ids.length === 0) {
      return ResponseHelper.validationError(
        "缺少 ids 或 all 参数",
        "请提供要删除的记录，或使用 all 删除当前筛选结果",
      );
    }

    const clauses = [];
    const params = [];

    if (ids.length > 0) {
      const capped = ids.slice(0, MAX_IDS);
      clauses.push(`id IN (${capped.map(() => "?").join(", ")})`);
      params.push(...capped);
    }

    if (selectAll) {
      const filter = body.filter && body.filter !== "all" ? body.filter : null;
      const rangeStart = getDeletedRangeStart(body.range);
      const search = body.search ? String(body.search).trim() : "";

      if (filter) {
        clauses.push("deleted_reason = ?");
        params.push(filter);
      }
      if (rangeStart) {
        clauses.push("deleted_at >= ?");
        params.push(rangeStart);
      }
      if (search) {
        clauses.push("(title LIKE ? OR url LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
      }
    }

    const whereClause = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    const result = await env.BOOKMARKS_DB.prepare(
      `DELETE FROM deleted_bookmarks${whereClause}`,
    )
      .bind(...params)
      .run();

    if (!result.success) {
      throw new Error("批量删除失败");
    }

    await recordAuditLog(env, "trash_batch_delete", {
      deleted: result.meta?.changes ?? 0,
      all: selectAll,
    });

    return ResponseHelper.success(
      { deleted: result.meta?.changes ?? 0 },
      "批量删除成功",
    );
  } catch (error) {
    console.error("Failed to batch delete deleted bookmark records:", error);
    return ResponseHelper.serverError("批量删除记录失败", error.message);
  }
}
