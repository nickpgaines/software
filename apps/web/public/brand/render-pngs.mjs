// Render all Forge brand PNGs using Playwright with Inter loaded from Google Fonts.
// Usage: node render-pngs.mjs
import playwright from "/opt/node22/lib/node_modules/playwright/index.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const { chromium } = playwright;
const __dirname = dirname(fileURLToPath(import.meta.url));

const F_PATH = "M32 16 L92 16 L112 36 L52 36 L52 54 L88 54 L70 72 L52 72 L52 92 L32 112 Z";

const iconRoundedSvg = readFileSync(join(__dirname, "forge-icon.svg"), "utf8");
const iconSquareSvg = readFileSync(join(__dirname, "forge-icon-square.svg"), "utf8");

const browser = await chromium.launch();

async function renderSvgAt(svg, size, outName) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;padding:0;background:transparent">
     <div style="width:${size}px;height:${size}px">${svg.replace(
       /<svg /,
       `<svg width="${size}" height="${size}" `
     )}</div></body></html>`,
    { waitUntil: "load" }
  );
  await page.screenshot({ path: join(__dirname, outName), omitBackground: true, type: "png" });
  await page.close();
  console.log(`✓ ${outName}`);
}

async function renderLockup({ dpr, bg, color, radius = 0, outName }) {
  // Design at CSS pixels; deviceScaleFactor scales the output resolution.
  const page = await browser.newPage({
    viewport: { width: 2000, height: 600 },
    deviceScaleFactor: dpr,
  });
  const html = `<!doctype html><html><head>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@800&display=block">
    <style>
      html,body{margin:0;padding:0;background:transparent;width:100%;height:100%;
        display:flex;align-items:center;justify-content:center;
        font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
      .card{background:${bg};${radius ? `border-radius:${radius}px;` : ""}
        display:flex;align-items:center;gap:64px;padding:96px 128px;}
      .mark{width:256px;height:256px;flex-shrink:0;}
      .mark svg{display:block;width:100%;height:100%;}
      .wm{font-size:256px;font-weight:800;letter-spacing:0.18em;color:${color};line-height:1;
        font-feature-settings:"cv11","ss01";white-space:nowrap;}
    </style>
  </head><body>
    <div class="card">
      <div class="mark"><svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><path d="${F_PATH}" fill="${color}"/></svg></div>
      <span class="wm">FORGE</span>
    </div>
  </body></html>`;
  await page.setContent(html, { waitUntil: "networkidle", timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  const el = await page.locator(".card");
  await el.screenshot({ path: join(__dirname, outName), omitBackground: bg === "transparent", type: "png" });
  await page.close();
  console.log(`✓ ${outName}`);
}

async function renderOg(outName) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  const html = `<!doctype html><html><head>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@800&display=block">
    <style>
      html,body{margin:0;padding:0;background:#000;width:100%;height:100%;
        display:flex;align-items:center;justify-content:center;
        font-family:'Inter',-apple-system,sans-serif;}
      .lockup{display:flex;align-items:center;gap:32px;}
      .mark{width:140px;height:140px;}
      .wm{font-size:140px;font-weight:800;letter-spacing:0.18em;color:#fff;line-height:1;
        font-feature-settings:"cv11","ss01";}
    </style>
  </head><body>
    <div class="lockup">
      <div class="mark"><svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><path d="${F_PATH}" fill="#fff"/></svg></div>
      <span class="wm">FORGE</span>
    </div>
  </body></html>`;
  await page.setContent(html, { waitUntil: "networkidle", timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(__dirname, outName), type: "png" });
  await page.close();
  console.log(`✓ ${outName}`);
}

try {
  const iconSizes = [16, 32, 48, 64, 128, 180, 192, 256, 512, 1024];
  for (const s of iconSizes) await renderSvgAt(iconRoundedSvg, s, `forge-icon-${s}.png`);
  for (const s of iconSizes) await renderSvgAt(iconSquareSvg, s, `forge-icon-square-${s}.png`);

  // Lockup variants — dpr 1, 2, 4 → roughly 1.5k, 3k, 6k wide PNGs.
  for (const dpr of [1, 2, 4]) {
    await renderLockup({ dpr, bg: "transparent", color: "#fff", outName: `forge-lockup-white-${dpr}x.png` });
    await renderLockup({ dpr, bg: "transparent", color: "#000", outName: `forge-lockup-black-${dpr}x.png` });
    await renderLockup({ dpr, bg: "#000", color: "#fff", radius: 48, outName: `forge-lockup-card-${dpr}x.png` });
  }

  await renderOg("forge-og.png");
} finally {
  await browser.close();
}
