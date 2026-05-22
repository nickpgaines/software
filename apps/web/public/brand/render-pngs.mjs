// Render forge-icon.svg to PNG at standard app-icon sizes using Playwright.
// Usage: node render-pngs.mjs
import playwright from "/opt/node22/lib/node_modules/playwright/index.js";
const { chromium } = playwright;
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sizes = [16, 32, 48, 64, 128, 180, 192, 256, 512, 1024];

const svg = readFileSync(join(__dirname, "forge-icon.svg"), "utf8");

const browser = await chromium.launch();
try {
  for (const size of sizes) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<!doctype html><html><body style="margin:0;padding:0;background:transparent">
       <div style="width:${size}px;height:${size}px">${svg.replace(
         '<svg ',
         `<svg width="${size}" height="${size}" `
       )}</div></body></html>`,
      { waitUntil: "load" }
    );
    const out = join(__dirname, `forge-icon-${size}.png`);
    await page.screenshot({ path: out, omitBackground: true, type: "png" });
    await page.close();
    console.log(`✓ ${out}`);
  }
} finally {
  await browser.close();
}
