// Role + permission model.
//
// Built-in roles: admin, salesperson, technician.
// Plus custom roles defined per-company via the `custom_roles` table.
//
// Old role values (manager / team_lead / salesperson_all / salesperson_own /
// field_tech / custom) are migrated forward in db.ts. This file is the
// single source of truth for the live model.

export type BuiltInRole = "admin" | "salesperson" | "technician";

export const BUILT_IN_ROLES: BuiltInRole[] = [
  "admin",
  "salesperson",
  "technician",
];

// Every permission the system knows about. Custom roles are an arbitrary
// subset of this list; the three built-ins are expressed as presets below.
export type Permission =
  // Jobs & Schedule
  | "jobs.view_all"
  | "jobs.edit"
  | "jobs.add"
  | "jobs.update_assigned"
  | "schedule.view"
  | "estimates.create"
  // Map & Territory
  | "map.view"
  | "territory.view"
  | "territory.edit"
  | "markers.view"
  // Leads
  | "leads.view"
  // Customers & Communication
  | "customers.manage"
  | "customers.view"
  | "messages.view"
  // Reports & Analytics
  | "reports.view"
  | "leaderboard.view_sales"
  | "leaderboard.view_tech"
  // System & Settings
  | "team.manage"
  | "settings.view_all";

export type PermissionGroup = {
  key: string;
  label: string;
  icon: "briefcase" | "map" | "inbox" | "chat" | "chart" | "settings";
  permissions: { key: Permission; title: string; description: string }[];
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "jobs",
    label: "Jobs & Schedule",
    icon: "briefcase",
    permissions: [
      { key: "jobs.view_all", title: "View All Jobs", description: "Can view all jobs in the organization" },
      { key: "jobs.edit", title: "Edit Jobs", description: "Can edit job details and status" },
      { key: "jobs.add", title: "Add Jobs", description: "Can create new jobs" },
      { key: "jobs.update_assigned", title: "Update Assigned Jobs", description: "Can update jobs assigned to them" },
      { key: "schedule.view", title: "View Schedule", description: "Can access the schedule" },
      { key: "estimates.create", title: "Create Estimates", description: "Can create new estimates" },
    ],
  },
  {
    key: "map",
    label: "Map & Territory",
    icon: "map",
    permissions: [
      { key: "map.view", title: "View Map", description: "Can access the map view" },
      { key: "territory.view", title: "View Territory", description: "Can view territory boundaries" },
      { key: "territory.edit", title: "Edit Territory", description: "Can create and modify territories" },
      { key: "markers.view", title: "View Markers", description: "Can view map markers" },
    ],
  },
  {
    key: "leads",
    label: "Leads",
    icon: "inbox",
    permissions: [
      { key: "leads.view", title: "View Leads", description: "Can access the leads pipeline" },
    ],
  },
  {
    key: "customers",
    label: "Customers & Communication",
    icon: "chat",
    permissions: [
      { key: "customers.manage", title: "Manage Customers", description: "Can create, edit, and delete customers" },
      { key: "customers.view", title: "View Customers", description: "Can view customer information" },
      { key: "messages.view", title: "View Messages", description: "Can access team messages" },
    ],
  },
  {
    key: "reports",
    label: "Reports & Analytics",
    icon: "chart",
    permissions: [
      { key: "reports.view", title: "View Reports", description: "Can access reports and analytics" },
      { key: "leaderboard.view_sales", title: "View Sales Leaderboard", description: "Can view the sales leaderboard" },
      { key: "leaderboard.view_tech", title: "View Technician Leaderboard", description: "Can view the technician leaderboard" },
    ],
  },
  {
    key: "system",
    label: "System & Settings",
    icon: "settings",
    permissions: [
      { key: "team.manage", title: "Manage Team", description: "Can add, edit, and remove team members" },
      { key: "settings.view_all", title: "View All Settings", description: "Can access organization settings beyond their own profile" },
    ],
  },
];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key)
);

const ADMIN_PERMS = new Set<Permission>(ALL_PERMISSIONS);

const SALESPERSON_PERMS = new Set<Permission>([
  "jobs.view_all",
  "jobs.edit",
  "jobs.add",
  "jobs.update_assigned",
  "schedule.view",
  "estimates.create",
  "map.view",
  "territory.view",
  "markers.view",
  "customers.manage",
  "customers.view",
  "messages.view",
  "leaderboard.view_sales",
]);

const TECHNICIAN_PERMS = new Set<Permission>([
  "jobs.update_assigned",
  "schedule.view",
  "customers.view",
  "messages.view",
  "leaderboard.view_tech",
]);

export const BUILT_IN_ROLE_PERMISSIONS: Record<BuiltInRole, Set<Permission>> = {
  admin: ADMIN_PERMS,
  salesperson: SALESPERSON_PERMS,
  technician: TECHNICIAN_PERMS,
};

export const BUILT_IN_ROLE_LABELS: Record<BuiltInRole, string> = {
  admin: "Admin",
  salesperson: "Salesperson",
  technician: "Technician",
};

export const BUILT_IN_ROLE_DESCRIPTIONS: Record<BuiltInRole, string> = {
  admin: "Full access to everything in the CRM.",
  salesperson:
    "Manage jobs, customers, schedule, and their own territory. Sees the sales leaderboard. Does not see leads, employees, or other reps' territories.",
  technician:
    "Sees only jobs assigned to them, the technician leaderboard, and messages. No leads, employees, map, or settings beyond their own profile.",
};

// Migration map: old PermissionLevel value → new role value.
export function migrateLegacyRole(legacy: string | null | undefined): BuiltInRole {
  switch ((legacy || "").trim()) {
    case "admin":
      return "admin";
    case "salesperson_all":
    case "salesperson_own":
      return "salesperson";
    case "field_tech":
      return "technician";
    case "manager":
    case "team_lead":
    case "custom":
    case "":
    case null:
    case undefined:
    default:
      return "admin";
  }
}

export function isBuiltInRole(value: string | null | undefined): value is BuiltInRole {
  return value === "admin" || value === "salesperson" || value === "technician";
}

// Resolve the effective permission set for an employee given their role
// string and optional custom role overrides. Returns a frozen Set.
export function resolvePermissions(
  role: string | null | undefined,
  customRolePermissions: Permission[] | null | undefined
): Set<Permission> {
  if (customRolePermissions && Array.isArray(customRolePermissions)) {
    return new Set<Permission>(
      customRolePermissions.filter((p): p is Permission =>
        (ALL_PERMISSIONS as string[]).includes(p as string)
      )
    );
  }
  if (isBuiltInRole(role)) {
    return new Set(BUILT_IN_ROLE_PERMISSIONS[role]);
  }
  // Unknown role: treat conservatively as admin to avoid lockout on legacy
  // rows that haven't been migrated yet.
  return new Set(ADMIN_PERMS);
}

export function hasPermission(
  perms: Set<Permission> | null | undefined,
  required: Permission
): boolean {
  return !!perms && perms.has(required);
}

// Convenience helpers for the most common nav-level checks.
export function canSeeLeads(perms: Set<Permission>) {
  return perms.has("leads.view");
}
export function canSeeMap(perms: Set<Permission>) {
  return perms.has("map.view");
}
export function canSeeEmployees(perms: Set<Permission>) {
  return perms.has("team.manage");
}
export function canSeeReports(perms: Set<Permission>) {
  return perms.has("reports.view");
}
export function canSeeFullSchedule(perms: Set<Permission>) {
  return perms.has("jobs.view_all");
}
export function canSeeAllSettings(perms: Set<Permission>) {
  return perms.has("settings.view_all");
}
