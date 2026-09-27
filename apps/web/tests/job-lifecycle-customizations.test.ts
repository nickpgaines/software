import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CUSTOMIZATIONS,
  mergeCustomizations,
} from "../src/lib/customizations.ts";

test("adds a disabled Job Started block to legacy customization JSON", () => {
  const merged = mergeCustomizations({
    messages: {
      drive_start: {
        ...DEFAULT_CUSTOMIZATIONS.messages.drive_start,
        template: "On our way",
      },
    } as never,
  });

  assert.equal(merged.messages.drive_start.template, "On our way");
  assert.deepEqual(merged.messages.job_started, {
    enabled: false,
    template: "Your technician has started the job.",
    include_personalized_header: false,
    include_driver_name_image: false,
  });
});
