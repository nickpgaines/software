import assert from "node:assert/strict";
import test from "node:test";
import { elements, hookRenderer, loadCustomerModule, text } from "./helpers/customer-ui.mjs";

const globals = globalThis as typeof globalThis & { __customerPlaces?: unknown };
const initial = { address_line1: "123 Main St", city: "Austin", state: "TX", zip: "78701", unit: "", formatted_address: "123 Main St, Austin, TX 78701", latitude: 30.25, longitude: -97.75 };
const waitForSuggestions = () => new Promise(resolve => setTimeout(resolve, 250));

async function setup(t: any, places: unknown) {
  const priorKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-key";
  globals.__customerPlaces = places;
  const oldDocument = globalThis.document;
  globalThis.document = { addEventListener() {}, removeEventListener() {} } as unknown as Document;
  const module = await loadCustomerModule("components/customers/AddressFields.tsx");
  let value = { ...initial };
  const props = { value, locationBias: { lat: 30.25, lng: -97.75 }, onChange(next: typeof value) { value = next; } };
  const outer = hookRenderer().render(module.default, props);
  const inner = outer.props.children;
  const renderer = hookRenderer();
  const render = () => renderer.render(inner.type, { ...inner.props, value, onChange: props.onChange });
  t.after(() => { renderer.dispose(); globalThis.document = oldDocument; globals.__customerPlaces = undefined; if (priorKey === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY; else process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = priorKey; });
  let tree = render();
  renderer.flushEffects();
  const input = elements(tree, (el: any) => el.props["aria-label"] === "Address")[0];
  input.props.onChange({ target: { value: "456 Oak" } });
  tree = render(); renderer.flushEffects();
  return { render, renderer, value: () => value };
}

test("autocomplete typing clears old coordinates and announces provider failure with manual fields still available", async t => {
  const ui = await setup(t, { AutocompleteSessionToken: class {}, AutocompleteSuggestion: { async fetchAutocompleteSuggestions() { throw new Error("REQUEST_DENIED"); } } });
  assert.equal(ui.value().latitude, null);
  assert.equal(ui.value().longitude, null);
  await waitForSuggestions();
  const tree = ui.render();
  assert.match(text(tree), /unavailable|couldn.t|could not/i);
  assert.match(text(tree), /manual/i);
  assert.equal(elements(tree, (el: any) => el.props.skipLine1 === true).length, 1);
});

test("address suggestion click fills structured fields and biases lookup to the pin", async t => {
  let request: any;
  const place = {
    async fetchFields() {}, formattedAddress: "456 Oak Ave, Austin, TX 78702",
    location: { lat: () => 30.26, lng: () => -97.74 },
    addressComponents: [
      { types: ["street_number"], longText: "456", shortText: "456" },
      { types: ["route"], longText: "Oak Avenue", shortText: "Oak Ave" },
      { types: ["locality"], longText: "Austin", shortText: "Austin" },
      { types: ["administrative_area_level_1"], longText: "Texas", shortText: "TX" },
      { types: ["postal_code"], longText: "78702", shortText: "78702" },
    ],
  };
  const ui = await setup(t, { AutocompleteSessionToken: class {}, AutocompleteSuggestion: { async fetchAutocompleteSuggestions(input: unknown) {
    request = input;
    return { suggestions: [{ placePrediction: { placeId: "oak", mainText: { text: "456 Oak Ave" }, secondaryText: { text: "Austin, TX" }, toPlace: () => place } }] };
  } } });
  await waitForSuggestions();
  assert.deepEqual(request.locationBias.center, { lat: 30.25, lng: -97.75 });
  const tree = ui.render();
  const choice = elements(tree, (el: any) => text(el).includes("456 Oak Ave") && typeof el.props.onClick === "function")[0];
  assert.ok(choice, "suggestion supports normal click/touch activation");
  await choice.props.onClick();
  assert.deepEqual(ui.value(), { ...initial, address_line1: "456 Oak Avenue", city: "Austin", state: "TX", zip: "78702", latitude: 30.26, longitude: -97.74, formatted_address: "456 Oak Ave, Austin, TX 78702" });
});

test("keyboard selection explains a place-detail failure and keeps the manually entered address", async t => {
  const ui = await setup(t, { AutocompleteSessionToken: class {}, AutocompleteSuggestion: { async fetchAutocompleteSuggestions() {
    return { suggestions: [{ placePrediction: { placeId: "oak", mainText: { text: "456 Oak Ave" }, secondaryText: { text: "Austin, TX" }, toPlace: () => ({ async fetchFields() { throw new Error("offline"); } }) } }] };
  } } });
  await waitForSuggestions();
  let tree = ui.render();
  const input = elements(tree, (el: any) => el.props["aria-label"] === "Address")[0];
  let prevented = false;
  input.props.onKeyDown({ key: "Enter", preventDefault() { prevented = true; } });
  await new Promise(resolve => setImmediate(resolve));
  tree = ui.render();
  assert.equal(prevented, true, "selection must not submit the customer form");
  assert.equal(ui.value().address_line1, "456 Oak");
  assert.match(text(tree), /manual/i);
  assert.match(text(tree), /could not/i);
});

test("a late place-detail response cannot replace newer address typing", async t => {
  let finish: (() => void) | undefined;
  const ui = await setup(t, { AutocompleteSessionToken: class {}, AutocompleteSuggestion: { async fetchAutocompleteSuggestions() {
    return { suggestions: [{ placePrediction: { placeId: "oak", mainText: { text: "456 Oak Ave" }, secondaryText: { text: "Austin, TX" }, toPlace: () => ({ fetchFields: () => new Promise<void>(resolve => { finish = resolve; }), formattedAddress: "456 Oak Ave, Austin, TX", addressComponents: [] }) } }] };
  } } });
  await waitForSuggestions();
  const tree = ui.render();
  const choice = elements(tree, (el: any) => text(el).includes("456 Oak Ave") && typeof el.props.onClick === "function")[0];
  const selection = choice.props.onClick();
  const input = elements(tree, (el: any) => el.props["aria-label"] === "Address")[0];
  input.props.onChange({ target: { value: "999 New St" } });
  assert.ok(finish);
  finish();
  await selection;
  assert.equal(ui.value().address_line1, "999 New St");
  assert.equal(ui.value().formatted_address, "");
});
