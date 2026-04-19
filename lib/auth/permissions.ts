export type AppRole =
  | "admin"
  | "supervisor"
  | "vendedor"
  | "responsable"
  | "soporte"
  | "afiliado"
  | "cliente";

export function canAccessDashboard(role: AppRole) {
  return ["admin", "supervisor", "vendedor", "responsable", "soporte"].includes(role);
}

export function canManageUsers(role: AppRole) {
  return role === "admin";
}

export function canManageCommissions(role: AppRole) {
  return ["admin", "supervisor"].includes(role);
}

export function canViewAffiliatePortal(role: AppRole) {
  return role === "afiliado";
}

export function canViewClientPortal(role: AppRole) {
  return role === "cliente";
}

export function getDefaultRouteByRole(role: AppRole) {
  switch (role) {
    case "admin":
      return "/dashboard";
    case "supervisor":
      return "/dashboard";
    case "vendedor":
      return "/leads";
    case "responsable":
      return "/solicitudes";
    case "soporte":
      return "/tickets";
    case "afiliado":
      return "/portal-afiliado";
    case "cliente":
      return "/portal-cliente";
    default:
      return "/login";
  }
}