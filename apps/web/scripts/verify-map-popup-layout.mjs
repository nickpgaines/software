// Node 24: node --experimental-strip-types scripts/verify-map-popup-layout.mjs
// Requires Playwright + Chrome. An existing Playwright module can be supplied
// through FORGE_PLAYWRIGHT_MODULE; optional screenshots use FORGE_SCREENSHOT_DIR.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mountMap } from "../tests/helpers/map-component.ts";

const { chromium } = await import(process.env.FORGE_PLAYWRIGHT_MODULE || "playwright");
const state = await mountMap();
const popup = state.openPin();
const content = { style: popup.node.style.cssText, html: popup.node.innerHTML, options: popup.options };
state.dispose();
const css = readFileSync(new URL("../node_modules/mapbox-gl/dist/mapbox-gl.css", import.meta.url), "utf8");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const width of [320, 390, 768]) {
    const page = await browser.newPage({ viewport: { width, height: 550 }, deviceScaleFactor: 2 });
    await page.setContent(`<style>${css}
      *{box-sizing:border-box}body{margin:0;background:#161616}
      .mapboxgl-map{height:100vh;width:100vw}
      .mapboxgl-popup{left:16px;top:80px;max-width:${content.options.maxWidth || "240px"}}
      </style><div class="mapboxgl-map"><div class="mapboxgl-popup mapboxgl-popup-anchor-bottom">
      <div class="mapboxgl-popup-content"><button class="mapboxgl-popup-close-button">×</button>
      <div style="${content.style}">${content.html}</div></div></div></div>`);
    for (const longText of [false, true]) {
      if (longText) await page.locator("[data-pin-title]").evaluate(element => { element.textContent = "A".repeat(120); });
      const bounds = await page.evaluate(() => {
        const popup = document.querySelector(".mapboxgl-popup-content").getBoundingClientRect();
        const button = document.querySelector("[data-action=delete]").getBoundingClientRect();
        const card = document.querySelector(".mapboxgl-popup-content");
        return { cardLeft: popup.left, cardRight: popup.right, buttonLeft: button.left, buttonRight: button.right,
          scrollWidth: card.scrollWidth, width: card.clientWidth, viewport: innerWidth };
      });
      assert.ok(bounds.buttonLeft >= bounds.cardLeft && bounds.buttonRight <= bounds.cardRight, `Delete button overflows at ${width}px`);
      assert.ok(bounds.cardRight <= bounds.viewport && bounds.scrollWidth <= bounds.width, `Popup content overflows at ${width}px (long=${longText})`);
      console.log(`PASS ${width}px popup, long text=${longText}`);
      if (process.env.FORGE_SCREENSHOT_DIR && !longText) await page.screenshot({ path: join(process.env.FORGE_SCREENSHOT_DIR, `map-popup-${width}.png`) });
    }
    await page.close();
  }
} finally { await browser.close(); }
