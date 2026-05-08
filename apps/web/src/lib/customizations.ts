export type MessageBlock = {
  enabled: boolean;
  template: string;
  include_personalized_header: boolean;
  include_driver_name_image: boolean;
};

export type MessagesConfig = {
  job_creation: MessageBlock;
  drive_start: MessageBlock;
  drive_end: MessageBlock;
  job_finish: MessageBlock;
  invoice_message: MessageBlock;
  invoice_subject: string;
  receipt_message: MessageBlock;
  review_request: MessageBlock;
};

export type ReminderInterval = {
  key: string;
  label: string;
  enabled: boolean;
  send_time: string;
  notify_customer: boolean;
  notify_owner: boolean;
  notify_dispatched: boolean;
};

export type JobRemindersConfig = {
  intervals: ReminderInterval[];
  customer_methods: { sms: boolean; email: boolean };
  owner_methods: { push: boolean; email: boolean };
  dispatched_methods: { push: boolean; email: boolean };
  message_template: string;
};

export type DocumentSectionToggles = {
  show_logo: boolean;
  show_details: boolean;
  show_customer_details: boolean;
  show_business_details: boolean;
  show_line_items: boolean;
  show_total: boolean;
  show_footer: boolean;
  footer_text: string;
  note: string;
};

export type EstimateConfig = DocumentSectionToggles & {
  reminders_enabled: boolean;
  reminder_methods: { sms: boolean; email: boolean };
  reminder_drip_days: number[];
};

export type InvoiceConfig = DocumentSectionToggles & {
  show_payment_section: boolean;
  default_tip_options: number[];
  payment_button_label: string;
};

export type TermsConfig = {
  default_terms: string;
};

export type ServiceSubscriptionsConfig = {
  default_intro_message: string;
  default_renewal_reminder: string;
  cancellation_message: string;
};

export type PriceBookItem = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  category: string;
};

export type PriceBookConfig = {
  items: PriceBookItem[];
};

export type ChecklistTemplate = {
  id: string;
  name: string;
  items: string[];
};

export type ChecklistConfig = {
  templates: ChecklistTemplate[];
};

export type CustomizationConfig = {
  messages: MessagesConfig;
  job_reminders: JobRemindersConfig;
  estimates: EstimateConfig;
  invoices: InvoiceConfig;
  terms: TermsConfig;
  service_subscriptions: ServiceSubscriptionsConfig;
  price_book: PriceBookConfig;
  checklist: ChecklistConfig;
};

const EMPTY_BLOCK: MessageBlock = {
  enabled: true,
  template: "",
  include_personalized_header: false,
  include_driver_name_image: false,
};

export const DEFAULT_CUSTOMIZATIONS: CustomizationConfig = {
  messages: {
    job_creation: {
      ...EMPTY_BLOCK,
      enabled: false,
      template:
        "You have been scheduled for your work to be completed on {job_start}.",
    },
    drive_start: {
      ...EMPTY_BLOCK,
      template: "Your technician is on their way to your location.",
    },
    drive_end: {
      ...EMPTY_BLOCK,
      template: "Your technician has arrived.",
    },
    job_finish: {
      ...EMPTY_BLOCK,
      template: "Your work with {company_name} has finished.",
    },
    invoice_message: {
      ...EMPTY_BLOCK,
      template: "Here is our invoice. We appreciate your business.",
    },
    invoice_subject: "Here is your invoice",
    receipt_message: {
      ...EMPTY_BLOCK,
      template:
        "Thanks for your payment! Here is your receipt from {company_name}.",
    },
    review_request: {
      ...EMPTY_BLOCK,
      template:
        "Thanks for choosing {company_name}! If you have a moment, we'd love a review: {review_link}",
    },
  },
  job_reminders: {
    intervals: [
      {
        key: "1_week",
        label: "1 week",
        enabled: false,
        send_time: "11:00",
        notify_customer: true,
        notify_owner: false,
        notify_dispatched: false,
      },
      {
        key: "1_day",
        label: "1 day",
        enabled: false,
        send_time: "11:00",
        notify_customer: true,
        notify_owner: false,
        notify_dispatched: false,
      },
      {
        key: "2_weeks",
        label: "2 weeks",
        enabled: true,
        send_time: "11:00",
        notify_customer: true,
        notify_owner: true,
        notify_dispatched: true,
      },
      {
        key: "2_days",
        label: "2 days",
        enabled: true,
        send_time: "11:00",
        notify_customer: true,
        notify_owner: true,
        notify_dispatched: true,
      },
    ],
    customer_methods: { sms: true, email: false },
    owner_methods: { push: true, email: false },
    dispatched_methods: { push: true, email: false },
    message_template:
      "Hey {customer_first_name}, your service with {company_name} is scheduled for {job_start}. Reply YES to confirm or call us to reschedule.",
  },
  estimates: {
    show_logo: true,
    show_details: true,
    show_customer_details: true,
    show_business_details: true,
    show_line_items: true,
    show_total: true,
    show_footer: true,
    footer_text: "",
    note: "",
    reminders_enabled: false,
    reminder_methods: { sms: true, email: true },
    reminder_drip_days: [3, 5, 7],
  },
  invoices: {
    show_logo: true,
    show_details: true,
    show_customer_details: true,
    show_business_details: true,
    show_line_items: true,
    show_total: true,
    show_footer: true,
    footer_text: "",
    note: "",
    show_payment_section: true,
    default_tip_options: [10, 15, 20],
    payment_button_label: "Pay",
  },
  terms: {
    default_terms:
      "Payment is due upon receipt of invoice unless otherwise agreed in writing.",
  },
  service_subscriptions: {
    default_intro_message:
      "Thanks for subscribing to our service plan! We'll be in touch before each visit.",
    default_renewal_reminder:
      "Your service subscription with {company_name} will renew on {renewal_date}.",
    cancellation_message:
      "Your subscription with {company_name} has been cancelled. We're sorry to see you go.",
  },
  price_book: {
    items: [],
  },
  checklist: {
    templates: [],
  },
};

function mergeBlock(
  partial: Partial<MessageBlock> | undefined,
  fallback: MessageBlock
): MessageBlock {
  return { ...fallback, ...(partial || {}) };
}

export function mergeCustomizations(
  partial: Partial<CustomizationConfig> | null | undefined
): CustomizationConfig {
  const p = partial || {};
  const messages = (p.messages || {}) as Partial<MessagesConfig>;
  const reminders = (p.job_reminders || {}) as Partial<JobRemindersConfig>;
  return {
    messages: {
      job_creation: mergeBlock(
        messages.job_creation,
        DEFAULT_CUSTOMIZATIONS.messages.job_creation
      ),
      drive_start: mergeBlock(
        messages.drive_start,
        DEFAULT_CUSTOMIZATIONS.messages.drive_start
      ),
      drive_end: mergeBlock(
        messages.drive_end,
        DEFAULT_CUSTOMIZATIONS.messages.drive_end
      ),
      job_finish: mergeBlock(
        messages.job_finish,
        DEFAULT_CUSTOMIZATIONS.messages.job_finish
      ),
      invoice_message: mergeBlock(
        messages.invoice_message,
        DEFAULT_CUSTOMIZATIONS.messages.invoice_message
      ),
      invoice_subject:
        typeof messages.invoice_subject === "string"
          ? messages.invoice_subject
          : DEFAULT_CUSTOMIZATIONS.messages.invoice_subject,
      receipt_message: mergeBlock(
        messages.receipt_message,
        DEFAULT_CUSTOMIZATIONS.messages.receipt_message
      ),
      review_request: mergeBlock(
        messages.review_request,
        DEFAULT_CUSTOMIZATIONS.messages.review_request
      ),
    },
    job_reminders: {
      intervals:
        Array.isArray(reminders.intervals) && reminders.intervals.length > 0
          ? reminders.intervals.map((i, idx) => ({
              ...DEFAULT_CUSTOMIZATIONS.job_reminders.intervals[
                Math.min(idx, DEFAULT_CUSTOMIZATIONS.job_reminders.intervals.length - 1)
              ],
              ...i,
            }))
          : DEFAULT_CUSTOMIZATIONS.job_reminders.intervals,
      customer_methods: {
        ...DEFAULT_CUSTOMIZATIONS.job_reminders.customer_methods,
        ...(reminders.customer_methods || {}),
      },
      owner_methods: {
        ...DEFAULT_CUSTOMIZATIONS.job_reminders.owner_methods,
        ...(reminders.owner_methods || {}),
      },
      dispatched_methods: {
        ...DEFAULT_CUSTOMIZATIONS.job_reminders.dispatched_methods,
        ...(reminders.dispatched_methods || {}),
      },
      message_template:
        typeof reminders.message_template === "string"
          ? reminders.message_template
          : DEFAULT_CUSTOMIZATIONS.job_reminders.message_template,
    },
    estimates: { ...DEFAULT_CUSTOMIZATIONS.estimates, ...(p.estimates || {}) },
    invoices: { ...DEFAULT_CUSTOMIZATIONS.invoices, ...(p.invoices || {}) },
    terms: { ...DEFAULT_CUSTOMIZATIONS.terms, ...(p.terms || {}) },
    service_subscriptions: {
      ...DEFAULT_CUSTOMIZATIONS.service_subscriptions,
      ...(p.service_subscriptions || {}),
    },
    price_book: {
      items: Array.isArray(p.price_book?.items) ? p.price_book!.items : [],
    },
    checklist: {
      templates: Array.isArray(p.checklist?.templates)
        ? p.checklist!.templates
        : [],
    },
  };
}
