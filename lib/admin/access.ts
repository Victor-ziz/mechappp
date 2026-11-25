export const staffPermissions = [
  { id: "products", label: "Cars and parts" },
  { id: "orders", label: "Orders" },
  { id: "reviews", label: "Reviews" },
  { id: "customers", label: "Customers" },
] as const;

export type StaffPermission = (typeof staffPermissions)[number]["id"];

type AccessUser = {
  app_metadata?: Record<string, unknown> | null;
};

export function storeRole(user: AccessUser) {
  const role = user.app_metadata?.role;
  return role === "admin" || role === "staff" ? role : null;
}

export function permissionsFor(user: AccessUser): StaffPermission[] {
  if (storeRole(user) === "admin") return staffPermissions.map((item) => item.id);
  if (storeRole(user) !== "staff" || !Array.isArray(user.app_metadata?.permissions)) return [];
  const granted = user.app_metadata.permissions;
  return staffPermissions.map((item) => item.id).filter((id) => granted.includes(id));
}

export function canAccess(user: AccessUser, permission: StaffPermission) {
  return permissionsFor(user).includes(permission);
}

export function cleanPermissions(input: string[]) {
  const granted = new Set(input);
  return staffPermissions.map((item) => item.id).filter((id) => granted.has(id));
}
