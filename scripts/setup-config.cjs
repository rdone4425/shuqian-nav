#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question, fallback = "") {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim() || fallback));
  });
}

function generateSecret() {
  return crypto.randomBytes(32).toString("base64");
}

async function main() {
  console.log("Bookmark Navigator config generator\n");

  const pagesName = await ask(
    "Pages project name (default: bookmark-navigator-pages): ",
    "bookmark-navigator-pages",
  );
  const dbName = await ask(
    "D1 database name (default: bookmark-navigator): ",
    "bookmark-navigator",
  );
  const dbId = await ask(
    "D1 database id (leave blank for local-only template): ",
    "",
  );
  const adminPassword = await ask(
    "Admin password for .dev.vars (default: change-me-now): ",
    "change-me-now",
  );
  const jwtSecret = await ask(
    "JWT secret for .dev.vars (default: random): ",
    generateSecret(),
  );

  const repoRoot = process.cwd();
  const pagesDir = path.join(repoRoot, "pages");
  const wranglerPath = path.join(pagesDir, "wrangler.toml");
  const devVarsPath = path.join(repoRoot, ".dev.vars");

  fs.mkdirSync(pagesDir, { recursive: true });

  const lines = [
    `name = "${pagesName}"`,
    'pages_build_output_dir = "../public"',
    'compatibility_date = "2026-04-07"',
    "",
    "[vars]",
    'ENVIRONMENT = "development"',
  ];

  if (dbId) {
    lines.push(
      "",
      "[[d1_databases]]",
      'binding = "BOOKMARKS_DB"',
      `database_name = "${dbName}"`,
      `database_id = "${dbId}"`,
    );
  } else {
    lines.push(
      "",
      "# Add a production D1 binding before deploy:",
      "# [[d1_databases]]",
      '# binding = "BOOKMARKS_DB"',
      `# database_name = "${dbName}"`,
      '# database_id = "YOUR_D1_DATABASE_ID"',
    );
  }

  fs.writeFileSync(wranglerPath, `${lines.join("\n")}\n`, "utf8");
  fs.writeFileSync(
    devVarsPath,
    `ADMIN_PASSWORD=${adminPassword}\nJWT_SECRET=${jwtSecret}\nENVIRONMENT=development\n`,
    "utf8",
  );

  console.log("\nGenerated files:");
  console.log(`- ${path.relative(repoRoot, wranglerPath)}`);
  console.log(`- ${path.relative(repoRoot, devVarsPath)}`);
  console.log("\nNext steps:");
  console.log("- Run: npm --prefix pages install");
  console.log("- Run: npm run db:init:local");
  console.log("- Run: npm run dev");
  console.log(
    "- For GitHub Actions deploys, add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN secrets",
  );
  console.log(
    "- CI will auto-create or reuse the Pages project and D1 database",
  );

  rl.close();
}

main().catch((error) => {
  console.error("Failed to generate config:", error);
  rl.close();
  process.exit(1);
});
