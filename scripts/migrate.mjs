import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const flags = new Set(process.argv.slice(2));
const remote = flags.has("--remote");
const local = flags.has("--local") || !remote;

if (flags.has("--remote") && flags.has("--local")) {
  console.error("[migrate] use either --local or --remote, not both.");
  process.exit(1);
}

const binding = process.env.D1_BINDING_NAME || "BOOKMARKS_DB";
const database = remote
  ? process.env.D1_DATABASE_NAME || "bookmark-navigator"
  : binding;
const wranglerBin = resolve("pages/node_modules/wrangler/bin/wrangler.js");
const persistTo = process.env.D1_PERSIST_TO || ".wrangler/state";

if (!existsSync(wranglerBin)) {
  console.error(
    "[migrate] wrangler not found under pages/node_modules. Run `npm --prefix pages install` first.",
  );
  process.exit(1);
}

function wranglerArgs(sql) {
  const args = [
    wranglerBin,
    "d1",
    "execute",
    database,
    remote ? "--remote" : "--local",
    "--config",
    "pages/wrangler.toml",
    "--json",
    "--command",
    sql,
  ];

  if (local) {
    args.push("--persist-to", persistTo);
  }

  return args;
}

function runSql(sql) {
  let stdout;

  try {
    stdout = execFileSync(process.execPath, wranglerArgs(sql), {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr = error.stderr ? String(error.stderr).trim() : "";
    throw new Error(`wrangler d1 execute failed: ${stderr || error.message}`);
  }

  // wrangler --json prints a JSON array; tolerate any leading banner/log text.
  const start = stdout.indexOf("[");
  if (start === -1) {
    throw new Error(`Unexpected wrangler output: ${stdout.slice(0, 400)}`);
  }

  try {
    return JSON.parse(stdout.slice(start));
  } catch (error) {
    throw new Error(
      `Unable to parse wrangler JSON output (${error.message}): ${stdout.slice(start, start + 400)}`,
    );
  }
}

function query(sql) {
  const payload = runSql(sql);

  for (let i = payload.length - 1; i >= 0; i -= 1) {
    if (Array.isArray(payload[i]?.results)) {
      return payload[i].results;
    }
  }

  return [];
}

const columnCache = new Map();

const ctx = {
  query,
  async exec(sql) {
    runSql(sql);
  },
  async columns(table) {
    if (!columnCache.has(table)) {
      let rows = [];
      try {
        rows = query(`PRAGMA table_info(${table})`);
      } catch {
        rows = [];
      }
      columnCache.set(table, new Set(rows.map((row) => row.name)));
    }
    return columnCache.get(table);
  },
  async columnExists(table, column) {
    const columns = await ctx.columns(table);
    return columns.has(column);
  },
  async tableExists(table) {
    const safeTable = String(table).replace(/'/g, "''");
    const rows = query(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${safeTable}'`,
    );
    return rows.length > 0;
  },
};

console.log(`[migrate] target: ${database} (${remote ? "remote" : "local"})`);

runSql(
  "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
);

const applied = new Set(
  query("SELECT version FROM schema_migrations").map((row) => row.version),
);

const migrationsDir = resolve("db/migrations");
const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".mjs"))
  .sort();

for (const file of migrationFiles) {
  const module = await import(pathToFileURL(join(migrationsDir, file)).href);
  const version = module.version || file.replace(/\.mjs$/, "");

  if (!/^[A-Za-z0-9_-]+$/.test(version)) {
    throw new Error(`Invalid migration version: ${version}`);
  }

  if (applied.has(version)) {
    console.log(`[migrate] skip ${version} (already applied)`);
    continue;
  }

  console.log(`[migrate] apply ${version}`);
  await module.up(ctx);
  await ctx.exec(
    `INSERT INTO schema_migrations (version) VALUES ('${version}')`,
  );
  applied.add(version);
}

console.log(`[migrate] done (${applied.size} applied)`);
