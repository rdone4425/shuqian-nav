#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const cleanMode = args.includes("--clean");
const repoRoot = process.cwd();
const pagesDir = path.join(repoRoot, "pages");
const schemaPath = path.join(repoRoot, "db", "schema.sql");

function log(message) {
  console.log(`[reset] ${message}`);
}

function ensureFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function ensureConfig() {
  const wranglerPath = path.join(pagesDir, "wrangler.toml");
  ensureFile(wranglerPath, "Wrangler config");

  if (!fs.existsSync(path.join(repoRoot, ".dev.vars"))) {
    log(
      "Missing .dev.vars. Run `npm run config` first if you need local secrets.",
    );
  }
}

function main() {
  ensureFile(schemaPath, "Schema file");
  ensureConfig();

  if (cleanMode) {
    log(
      "`--clean` now applies the base schema only. Sample data is no longer inserted by deployment scripts.",
    );
  }

  log("Applying db/schema.sql to local D1 database binding BOOKMARKS_DB...");
  execSync(
    "npx wrangler d1 execute BOOKMARKS_DB --local --persist-to ../.wrangler/state --file ../db/schema.sql",
    {
      stdio: "inherit",
      cwd: pagesDir,
    },
  );

  log("Schema applied.");
  log("Next step: run `npm run dev` to start the Pages dev server.");
}

try {
  main();
} catch (error) {
  console.error("[reset] Failed:", error.message);
  process.exit(1);
}
