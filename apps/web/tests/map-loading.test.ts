import assert from "node:assert/strict";
import test from "node:test";
import { mountMap } from "./helpers/map-component.ts";

const pins = Array.from({ length: 1000 }, (_, i) => ({
  id: i + 1, lat: 33 + i / 100000, lng: -81, status: "not_home", address: `Test pin ${i + 1}`,
  created_at: "2026-09-18 18:00:00", notes: null,
}));
const customers = Array.from({ length: 600 }, (_, i) => ({
  id: i + 1, latitude: 33, longitude: -81 - i / 100000, name: `Test customer ${i + 1}`,
  has_active_subscription: i % 2, created_at: "2026-09-18 18:00:00",
  customer_employee_ids: [], subscription_employee_ids: [],
}));

test("loading many map pins publishes each complete cluster dataset once, not every growing prefix", async () => {
  const state = await mountMap({ pins, customers, trackSources: true });
  try {
    for (const [id, expected] of [["pins-source", 1000], ["customers-source", 600]] as const) {
      const updates = state.sourceUpdates.get(id)!.filter(data => data.features.length > 0);
      assert.equal(updates.length, 1, `${id} should publish one populated batch`);
      assert.equal(updates[0].features.length, expected);
      assert.equal(new Set(updates[0].features.map((f: any) => f.properties.id)).size, expected);
      assert.deepEqual(updates[0].features[0].geometry.coordinates, [-81, 33]);
    }
    assert.equal(state.markers.length, 1600, "keep all existing interactive markers");
    assert.match(state.openPin().node.innerHTML, /Test pin 1/);
  } finally { state.dispose(); }
});

test("location updates do not republish pin datasets and switching map style restores all data", async () => {
  const state = await mountMap({ pins: pins.slice(0, 3), customers: customers.slice(0, 2), trackSources: true });
  try {
    const before = state.sourceUpdates.get("pins-source")!.length;
    state.livePosition(33.001, -81.001);
    state.livePosition(33.002, -81.002);
    assert.equal(state.sourceUpdates.get("pins-source")!.length, before);
    const strip = state.componentTree.props.children.find((child: any) => child?.props?.onToggleStyle);
    strip.props.onToggleStyle();
    await state.map.emit("style.load");
    assert.equal(state.map.getSource("pins-source")!.data.features.length, 3);
    assert.equal(state.map.getSource("customers-source")!.data.features.length, 2);
  } finally { state.dispose(); }
});
