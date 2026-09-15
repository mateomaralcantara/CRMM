export type AppRole =
  | "super_admin"
  | "admin"
  | "supervisor"
  | "vendedor"
  | "responsable"
  | "soporte"
  | "afiliado"
  | "promotor"
  | "cliente";

export function isPrivileged(role: AppRole) {
  return role === "super_admin" || role === "admin";
}

export function canAccessDashboard(_role: AppRole) {
  return true;
}

export function canManageUsers(role: AppRole) {
  return isPrivileged(role);
}

export function canManagePrivilegedUsers(role: AppRole) {
  return role === "super_admin";
}

export function canManageCommissions(role: AppRole) {
  return isPrivileged(role);
}

export function canViewAffiliatePortal(role: AppRole) {
  return role === "afiliado" || role === "promotor";
}

export function canViewClientPortal(role: AppRole) {
  return role === "cliente";
}

export function canRegisterPayments(role: AppRole) {
  return ["super_admin", "admin", "supervisor", "responsable", "vendedor"].includes(role);
}

export function getDefaultRouteByRole(role: AppRole) {
  switch (role) {
    case "super_admin":
    case "admin":
      return "/";
    case "supervisor":
    case "vendedor":
    case "responsable":
      return "/hoy";
    case "soporte":
      return "/tickets";
    case "afiliado":
    case "promotor":
      return "/finanzas";
    case "cliente":
      return "/solicitudes";
    default:
      return "/login";
  }
}
