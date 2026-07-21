/**
 * Client-side role checks — UX gating only.
 *
 * These decide what buttons/actions are SHOWN in the UI. They are not a
 * security boundary: every action here is independently enforced
 * server-side (canAccessClient, the /api/tasks and /api/users route
 * checks, etc. from Sprint 4 hardening). Hiding a button here never
 * replaces the 403 a route returns if someone calls the API directly.
 */

export const ROLES = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  ACCOUNTANT: "ACCOUNTANT",
  DATA_ENTRY: "DATA_ENTRY",
  CLIENT: "CLIENT",
} as const;

export type Role = typeof ROLES[keyof typeof ROLES]

export const isStaffLeadership = (role: Role) => role === "ADMIN" || role === "MANAGER"

export const canCreateTask = (role: Role) => isStaffLeadership(role)
export const canReassignTask = (role: Role) => isStaffLeadership(role)
export const canArchiveDocument = (role: Role) =>
  isStaffLeadership(role) || role === "ACCOUNTANT"
export const canEscalateCompliance = (role: Role) =>
  isStaffLeadership(role) || role === "ACCOUNTANT"
export const canManageUsers = (role: Role) => role === "ADMIN"
