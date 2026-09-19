// 30-day visit trend data for dashboard chart
import { authenticateRequest } from "../auth/verify.js";
import { ResponseHelper } from "../../utils/response-helper.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = await authenticateRequest(request, env);
  if (!auth.authenticated) {
    return ResponseHelper.unauthorized(auth.error);
  }

  try {
    // Try daily_analytics first
    const result = await env.BOOKMARKS_DB.prepare(
      "SELECT date_key, total_visits FROM daily_analytics ORDER BY date_key DESC LIMIT 30",
    ).all();

    if (result.results && result.results.length > 0) {
      const data = result.results.reverse().map((row) => ({
        date: row.date_key,
        visits: row.total_visits || 0,
      }));
      return ResponseHelper.success({ data });
    }

    // Fallback: aggregate bookmark_visits
    const visitsResult = await env.BOOKMARKS_DB.prepare(
      `SELECT DATE(visit_time) as date_key, COUNT(*) as total_visits
       FROM bookmark_visits
       WHERE visit_time >= DATE('now', '-30 days')
       GROUP BY DATE(visit_time)
       ORDER BY date_key ASC`,
    ).all();

    const data = (visitsResult.results || []).map((row) => ({
      date: row.date_key,
      visits: row.total_visits,
    }));

    return ResponseHelper.success({ data });
  } catch (error) {
    return ResponseHelper.success({ data: [] });
  }
}
