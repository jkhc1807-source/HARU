// 네 폭에서 페이지를 열고 scripts/audit-ui.mjs 의 감사 스크립트를 주입한다.
// 사용법: node scripts/audit-run.mjs [url] [--shot <디렉토리>]
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { AUDIT_SCRIPT } from "./audit-ui.mjs";

const WIDTHS = [320, 390, 768, 1440];
const url = process.argv[2]?.startsWith("http") ? process.argv[2] : "http://localhost:3000/";
const shotIndex = process.argv.indexOf("--shot");
const shotDir = shotIndex > -1 ? process.argv[shotIndex + 1] : null;

if (shotDir) await mkdir(shotDir, { recursive: true });

const browser = await chromium.launch();
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const audit = await page.evaluate(`(${AUDIT_SCRIPT})()`);
  const screens = await page.evaluate("+(document.body.scrollHeight / window.innerHeight).toFixed(1)");
  console.log(`\n=== ${width}px === 화면수 ${screens}`);
  console.log(JSON.stringify(audit, null, 2));
  if (shotDir) await page.screenshot({ path: `${shotDir}/${width}.png`, fullPage: true, animations: "disabled" });
  await page.close();
}
await browser.close();
