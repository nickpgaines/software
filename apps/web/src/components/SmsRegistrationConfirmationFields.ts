import { createElement, type ReactNode } from "react";

export type SmsRegistrationConfirmationValues = {
  confirmed_authorized: boolean;
  confirmed_aup_tcpa: boolean;
  confirmed_consent: boolean;
};

type StoredRegistrationConfirmations = {
  confirmed_authorized: number;
  confirmed_aup_tcpa: number;
  confirmed_consent: number;
};

type CheckboxControlProps = {
  checked?: boolean | "indeterminate";
  disabled?: boolean;
  onCheckedChange?: (value: boolean | "indeterminate") => void;
  "aria-label"?: string;
};

type Props = {
  values: SmsRegistrationConfirmationValues;
  disabled?: boolean;
  onChange: (
    key: keyof SmsRegistrationConfirmationValues,
    value: boolean
  ) => void;
  renderCheckbox: (props: CheckboxControlProps) => ReactNode;
};

const CONFIRMATIONS: Array<{
  key: keyof SmsRegistrationConfirmationValues;
  ariaLabel: string;
  text: string;
}> = [
  {
    key: "confirmed_authorized",
    ariaLabel: "Authorized to register this business",
    text: "I am authorized to register this business with carriers.",
  },
  {
    key: "confirmed_aup_tcpa",
    ariaLabel: "Agreement with the SMS AUP and TCPA",
    text: "I agree to the SMS Acceptable Use Policy and the TCPA.",
  },
  {
    key: "confirmed_consent",
    ariaLabel: "Recipient consent confirmation",
    text: "Every recipient I will text has provided express consent.",
  },
];

export function registrationConfirmationValues(
  registration: StoredRegistrationConfirmations
): SmsRegistrationConfirmationValues {
  return {
    confirmed_authorized: registration.confirmed_authorized === 1,
    confirmed_aup_tcpa: registration.confirmed_aup_tcpa === 1,
    confirmed_consent: registration.confirmed_consent === 1,
  };
}

export function SmsRegistrationConfirmationFields({
  values,
  disabled = false,
  onChange,
  renderCheckbox,
}: Props) {
  return createElement(
    "div",
    { className: "space-y-2 pt-2" },
    CONFIRMATIONS.map(({ key, ariaLabel, text }) =>
      createElement(
        "label",
        {
          key,
          className:
            "flex items-start gap-2 text-sm text-zinc-300 cursor-pointer",
        },
        renderCheckbox({
          checked: values[key],
          disabled,
          "aria-label": ariaLabel,
          onCheckedChange: (value) => onChange(key, value === true),
        }),
        createElement("span", null, text)
      )
    )
  );
}
