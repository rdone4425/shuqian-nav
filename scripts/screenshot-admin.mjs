// scripts/screenshot-admin.mjs
// Full-page desktop screenshots of the public home + login + 9 admin pages,
// for before/after visual diffing during the admin-UI unification.
// Usage: node scripts/screenshot-admin.mjs <label>   e.g. `baseline`, `pilot-after`
// Reuses the auth/launch pattern from scripts/audit-buttons.mjs.
import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import puppeteer from "puppeteer-core";

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:8788";
const executablePath =
  process.env.CHROME_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";

function readDevVar(name) {
  try {
    const txt = readFileSync(".dev.vars", "utf8");
    const m = txt.match(new RegExp(`^\\uFEFF?${name}=(.*)$`, "m"));
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

const password =
  process.env.AUDIT_PASSWORD || readDevVar("ADMIN_PASSWORD") || "admin123";

const label = process.argv[2] || "shots";
const outDir = join(tmpdir(), "shuqian-nav-shots", label);
mkdirSync(outDir, { recursive: true });

// home + 9 admin pages (login captured separately, pre-auth). Paths mirror audit-buttons.mjs.
const PAGES = [
  ["home", "/"],
  ["admin-dashboard", "/admin-dashboard.html"],
  ["admin-settings", "/admin-settings.html"],
  ["bookmarks-manage", "/bookmarks-manage.html"],
  ["categories", "/categories.html"],
  ["deleted-bookmarks", "/deleted-bookmarks"],
  ["import", "/import.html"],
  ["link-checker", "/link-checker.html"],
  ["notifications", "/notifications.html"],
  ["token", "/token.html"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  const file = join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`shot: ${name} -> ${file}`);
}

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
page.on("dialog", (d) => d.dismiss());

try {
  // 1) login page (unauthenticated)
  await page.goto(`${base}/login.html`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  await page.waitForSelector("#password", { timeout: 10000 });
  await sleep(400);
  await shot(page, "login");

  // 2) authenticate using the same form
  await page.click("#password");
  await page.keyboard.type(password);
  await Promise.all([
    page
      .waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 })
      .catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  const token = await page.evaluate(() =>
    localStorage.getItem("bookmark_nav_token"),
  );
  if (!token) {
    console.error(
      "LOGIN FAILED — no token stored. Check ADMIN_PASSWORD in .dev.vars or set AUDIT_PASSWORD. Aborting.",
    );
    await browser.close();
    process.exit(1);
  }
  console.log("login: token stored");

  // 3) home + admin pages
  for (const [name, path] of PAGES) {
    try {
      await page.goto(`${base}${path}`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await sleep(700); // let async lists/toasts settle
      await shot(page, name);
    } catch (e) {
      console.log(`FAIL ${name}: ${e.message}`);
    }
  }
} finally {
  await browser.close();
}

console.log(`\nDone. Screenshots -> ${outDir}`);
