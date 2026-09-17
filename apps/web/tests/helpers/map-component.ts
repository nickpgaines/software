import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import * as React from "react";

const require = createRequire(new URL("../../package.json", import.meta.url));
type Listener = (event: any) => unknown;

class Element extends EventTarget {
  style: Record<string, string> = {};
  className = "";
  innerHTML = "";
  title = "";
  tagName: string;
  constructor(tagName = "DIV") { super(); this.tagName = tagName; }
  closest(selector: string) { return selector.split(",").some(s => s.trim() === `.${this.className}`) ? this : null; }
  querySelector() { return null; }
  setAttribute() {}
}

/** Execute the actual MapClient component; replace only browser/Mapbox/Next
 * boundaries. Touch tests deliberately omit browser-synthesized clicks, as
 * Mapbox Draw cancels those on touchend in the real app.
 */
export async function mountMap() {
  const effects: Array<() => void | (() => void)> = [];
  const cleanups: Array<() => void> = [];
  const markers: Marker[] = [];
  const popups: Popup[] = [];
  const navigation: string[] = [];
  let map!: MapStub;
  let livePosition: ((value: { lat: number; lng: number }) => void) | undefined;
  let stopped = 0;
  let componentTree: any;
  const canvas = new Element("CANVAS");
  class MapStub {
    listeners = new Map<string, Listener[]>();
    centers: unknown[] = [];
    constructor() { map = this; }
    on(name: string, layerOrListener: string | Listener, listener?: Listener) {
      if (typeof layerOrListener !== "string") this.listeners.set(name, [...this.listeners.get(name) ?? [], layerOrListener]);
      return this;
    }
    off(name: string, listener: Listener) { this.listeners.set(name, (this.listeners.get(name) ?? []).filter(l => l !== listener)); }
    async emit(name: string, event: any = {}) { for (const listener of this.listeners.get(name) ?? []) await listener(event); }
    addControl() {}
    getSource() { return null; }
    addSource() {}
    getLayer() { return null; }
    addLayer() {}
    getCanvas() { return canvas; }
    getCanvasContainer() { return canvas; }
    getContainer() { return canvas; }
    getZoom() { return 15; }
    resize() {}
    jumpTo(options: unknown) { this.centers.push(options); }
    easeTo(options: unknown) { this.centers.push(options); }
    remove() {}
  }
  class Marker {
    position: unknown;
    options: { element: Element };
    constructor(options: { element: Element }) { this.options = options; markers.push(this); }
    setLngLat(position: unknown) { this.position = position; return this; }
    addTo() { return this; }
    getElement() { return this.options.element; }
    remove() {}
  }
  class Popup {
    node!: Element;
    removed = false;
    close?: () => void;
    options: Record<string, unknown>;
    constructor(options: Record<string, unknown>) { this.options = options; popups.push(this); }
    setLngLat() { return this; }
    setDOMContent(node: Element) { this.node = node; return this; }
    addTo() { return this; }
    on(_name: string, listener: () => void) { this.close = listener; return this; }
    remove() { this.removed = true; this.close?.(); }
  }
  const globals = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch,
    getComputedStyle: globalThis.getComputedStyle };
  Object.assign(globalThis, {
    window: { matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) },
    document: { createElement: () => new Element(), documentElement: new Element(), hidden: false },
    getComputedStyle: () => ({ getPropertyValue: () => "#ffffff" }),
    fetch: async (url: string) => Response.json(url === "/api/map/pins" ? [{
      id: 1, lat: 33, lng: -81, address: "123 Example Street", status: "sold", notes: "Sample note", created_at: "2026-09-16",
    }] : []),
  });
  const cache = new Map<string, any>();
  const load = (filename: string): any => {
    if (cache.has(filename)) return cache.get(filename);
    const module = { exports: {} as any };
    cache.set(filename, module.exports);
    const code = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText;
    const resolve = (specifier: string): any => {
      if (specifier.endsWith(".css")) return {};
      if (specifier === "mapbox-gl") return { Map: MapStub, Marker, Popup };
      if (specifier === "@mapbox/mapbox-gl-draw") return class Draw {};
      if (specifier === "next/navigation") return { useRouter: () => ({ push: (url: string) => navigation.push(url) }) };
      if (specifier === "react") return { ...React,
        useRef: (value: unknown) => ({ current: value }),
        useState: (value: unknown) => [typeof value === "function" ? value() : value, () => {}],
        useEffect: (effect: () => void) => effects.push(effect),
      };
      if (specifier === "@/lib/native") return {
        getCurrentPosition: async () => ({ lat: 33, lng: -81 }),
        watchForegroundPosition: (callback: typeof livePosition) => { livePosition = callback; return () => { stopped++; }; },
      };
      if (specifier.startsWith("./") && filename.endsWith("MapClient.tsx")) return () => null;
      if (specifier.startsWith("@/")) return load(fileURLToPath(new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url)));
      return require(specifier);
    };
    new Function("require", "module", "exports", code)(resolve, module, module.exports);
    return module.exports;
  };
  try {
    const component = load(fileURLToPath(new URL("../../src/components/MapClient.tsx", import.meta.url))).default;
    componentTree = component();
    componentTree.props.children[0].ref.current = canvas;
    for (const effect of effects) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
    await map.emit("load");
    return {
      map, markers, popups, navigation, componentTree,
      livePosition: (lat: number, lng: number) => livePosition?.({ lat, lng }),
      get stopped() { return stopped; },
      openPin() { markers[0].getElement().dispatchEvent(new Event("click")); return popups.at(-1)!; },
      async touch(name: string, x: number, y: number, target: Element = canvas, touches = 1) {
        await map.emit(name, { point: { x, y }, originalEvent: { target, touches: Array(touches).fill({}), preventDefault() {} } });
      },
      dispose() { cleanups.forEach(cleanup => cleanup()); Object.assign(globalThis, globals); },
    };
  } catch (error) {
    cleanups.forEach(cleanup => cleanup());
    Object.assign(globalThis, globals);
    throw error;
  }
}
