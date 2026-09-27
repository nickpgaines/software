import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";

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
