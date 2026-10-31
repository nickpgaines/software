import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { loadCustomerModule } from "./helpers/customer-ui.mjs";

test("messaging summary distinguishes approval from active two-way routing without a billing upsell", async () => {
  const component = await loadCustomerModule("components/SmsMessagingStatus.tsx").catch(() => null);
  assert.ok(component, "messaging status component must be available");
  const base = {
    a2p_registration_state: "campaign_approved", sms_tier: "paid_approved",
    sms_dedicated_number: "+12025550199", sms_dedicated_number_sid: "PNnumber",
    twilio_messaging_service_sid: "MGservice", twilio_campaign_sid: "QEcampaign",
  };
  const markup = (company: Record<string, unknown>) => renderToStaticMarkup(createElement(component.SmsMessagingStatus, { company }));
  assert.match(markup(base), /Two-way active/);
  for (const missing of ["sms_dedicated_number", "sms_dedicated_number_sid", "twilio_messaging_service_sid", "twilio_campaign_sid"]) {
    const incomplete = markup({ ...base, [missing]: null });
    assert.doesNotMatch(incomplete, /Two-way active|texting is enabled/);
    assert.match(incomplete, /number setup|setting up/i);
  }
  const inactive = markup({ ...base, sms_tier: "trial" });
  assert.doesNotMatch(inactive, /Two-way active|texting is enabled/);
  assert.match(inactive, /number setup|setting up/i);
  const pending = markup({ ...base, a2p_registration_state: "trust_product_pending", sms_tier: "trial" });
  assert.match(pending, /Pending review/);
  assert.doesNotMatch(pending, /Trial Plan|Upgrade to a paid plan|Two-way active/);
  const failed = markup({ ...base, a2p_registration_state: "customer_profile_failed", sms_tier: "trial" });
  assert.match(failed, /Needs attention/);
  assert.doesNotMatch(failed, /Pending review|Two-way active/);
});

test("approved saved registration renders all submitted confirmations checked", async () => {
  const componentPath = "../src/components/SmsRegistrationConfirmationFields.ts";
  const component = await import(componentPath).catch(() => null);
  assert.ok(component, "registration confirmation component must be available");

  const values = component.registrationConfirmationValues({
    confirmed_authorized: 1,
    confirmed_aup_tcpa: 1,
    confirmed_consent: 1,
  });
  const CheckboxControl = (props: {
    checked: boolean;
    disabled?: boolean;
    "aria-label"?: string;
  }) =>
    createElement("input", {
      type: "checkbox",
      checked: props.checked,
      disabled: props.disabled,
      "aria-label": props["aria-label"],
      readOnly: true,
    });
  const markup = renderToStaticMarkup(
    createElement(component.SmsRegistrationConfirmationFields, {
      values,
      disabled: true,
      onChange: () => {},
      renderCheckbox: (props: Parameters<typeof CheckboxControl>[0]) =>
        createElement(CheckboxControl, props),
    })
  );

  assert.equal((markup.match(/checked=""/g) || []).length, 3);
  assert.equal((markup.match(/disabled=""/g) || []).length, 3);
  assert.match(markup, /aria-label="Authorized to register this business"/);
  assert.match(markup, /aria-label="Agreement with the SMS AUP and TCPA"/);
  assert.match(markup, /aria-label="Recipient consent confirmation"/);
});
