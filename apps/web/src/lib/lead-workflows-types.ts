// Client-safe types & constants for lead workflows.
//
// The server runtime (executor, fireTrigger) lives in `lead-workflows.ts`
// because it pulls in Twilio (which depends on Node's `tls`/`fs`/`node:crypto`
// modules that webpack can't bundle for the browser). Anything imported by a
// React Client Component must come from this file instead.

export type WorkflowTrigger =
  | "lead_created"
  | "lead_stage_changed"
  | "lead_replied"
  | "missed_call"
  | "estimate_sent"
  | "estimate_accepted";

export const WORKFLOW_TRIGGERS: { value: WorkflowTrigger; label: string }[] = [
  { value: "lead_created", label: "A new lead is created" },
  { value: "lead_stage_changed", label: "Lead is moved to a stage" },
  { value: "lead_replied", label: "Lead replies" },
  { value: "missed_call", label: "Missed call" },
  { value: "estimate_sent", label: "Estimate is sent" },
  { value: "estimate_accepted", label: "Estimate is accepted" },
];

export type WorkflowStep =
  | { type: "delay"; minutes: number }
  | { type: "send_sms"; message: string }
  | {
      type: "update_stage";
      stage: "new" | "contacted" | "responded" | "estimate_sent";
    }
  | { type: "create_task"; title: string; due_in_minutes?: number }
  | { type: "notify_admin"; message: string };

export type WorkflowStepType = WorkflowStep["type"];

export const STEP_TYPES: {
  value: WorkflowStepType;
  label: string;
  description: string;
}[] = [
  {
    value: "send_sms",
    label: "Send text message",
    description: "Send an SMS to the lead",
  },
  {
    value: "delay",
    label: "Delay for",
    description: "Pause before the next step",
  },
  {
    value: "update_stage",
    label: "Update lead stage",
    description: "Move lead to another pipeline stage",
  },
  {
    value: "create_task",
    label: "Create task",
    description: "Create a task for a teammate",
  },
  {
    value: "notify_admin",
    label: "Notify admin",
    description: "Send SMS notification to the org phone",
  },
];

export function defaultStep(type: WorkflowStepType): WorkflowStep {
  switch (type) {
    case "send_sms":
      return { type: "send_sms", message: "Hi {{first_name}}, " };
    case "delay":
      return { type: "delay", minutes: 60 };
    case "update_stage":
      return { type: "update_stage", stage: "contacted" };
    case "create_task":
      return { type: "create_task", title: "Follow up with {{first_name}}" };
    case "notify_admin":
      return {
        type: "notify_admin",
        message: "New lead {{first_name}} {{last_name}} needs attention.",
      };
  }
}

export type WorkflowTemplate = {
  key: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
};

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    key: "missed_call_textback",
    name: "Missed Call Text-Back",
    description:
      "Instantly text leads when they call but don't get through to a real person.",
    trigger: "missed_call",
    steps: [
      {
        type: "send_sms",
        message:
          "Hi {{first_name}}, this is {{company_name}} — sorry we missed your call! How can we help?",
      },
      {
        type: "notify_admin",
        message:
          "Missed call from {{first_name}} {{last_name}} ({{phone}}). Auto-text sent.",
      },
    ],
  },
  {
    key: "new_lead_followup",
    name: "New Lead Follow-up (3-touch)",
    description:
      "Reach out to fresh leads three times over 48 hours so nothing falls through the cracks.",
    trigger: "lead_created",
    steps: [
      {
        type: "send_sms",
        message:
          "Hi {{first_name}}! Thanks for reaching out to {{company_name}}. We got your info and will be in touch shortly. Reply here anytime.",
      },
      { type: "delay", minutes: 60 },
      {
        type: "send_sms",
        message:
          "Hey {{first_name}} — just checking in. Still want to chat about your project? Reply YES and we'll give you a call.",
      },
      { type: "delay", minutes: 1440 },
      {
        type: "send_sms",
        message:
          "Hi {{first_name}}, last quick follow-up from {{company_name}}. Let us know if there's anything we can help with!",
      },
      { type: "update_stage", stage: "contacted" },
    ],
  },
  {
    key: "estimate_sent_followup",
    name: "Estimate Sent Follow-up",
    description:
      "Nudge prospects after you send an estimate so they don't go cold.",
    trigger: "estimate_sent",
    steps: [
      { type: "delay", minutes: 2880 },
      {
        type: "send_sms",
        message:
          "Hi {{first_name}}, just following up on the estimate we sent over. Any questions or anything we can clarify?",
      },
      { type: "delay", minutes: 4320 },
      {
        type: "send_sms",
        message:
          "Hey {{first_name}} — circling back on your estimate from {{company_name}}. Happy to walk through it or adjust anything.",
      },
      { type: "delay", minutes: 7200 },
      {
        type: "send_sms",
        message:
          "Hi {{first_name}}, last check-in on the estimate. Let us know if we should keep it open or close it out.",
      },
    ],
  },
];

export function parseSteps(raw: string): WorkflowStep[] {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as WorkflowStep[]) : [];
  } catch {
    return [];
  }
}
