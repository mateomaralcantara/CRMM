"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "@/components/crm/UsersRolesSkin.module.css";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
};

type RolePermission = {
  id: string;
  role: string;
  module: string;
  action: string;
  scope: string;
  allowed: boolean;
};

type PermissionForm = {
  role: string;
  module: string;
  action: string;
  scope: string;
  allowed: boolean;
};

const roles = [
  { value: "admin", label: "Admin" },
  { value: "supervisor", label: "Supervisor" },
  { value: "responsable", label: "Responsable" },
  { value: "vendedor", label: "Vendedor" },
  { value: "soporte", label: "Soporte" },
  { value: "promotor", label: "Promotor" },
  { value: "afiliado", label: "Afiliado" },
  { value: "cliente", label: "Cliente" },
];

const modules = [
  { value: "dashboard", label: "Dashboard" },
  { value: "profiles", label: "Usuarios" },
  { value: "role_permissions", label: "Roles" },
  { value: "clients", label: "Clientes" },
  { value: "leads", label: "Leads" },
  { value: "affiliates", label: "Afiliados" },
  { value: "tickets", label: "Tickets" },
  { value: "tasks", label: "Tareas" },
  { value: "service_requests", label: "Solicitudes" },
  { value: "commissions", label: "Comisiones" },
  { value: "documents", label: "Documentos" },
  { value: "activity_logs", label: "Actividad" },
];

const actions = [
  { value: "view", label: "Ver" },
  { value: "create", label: "Crear" },
  { value: "update", label: "Modificar" },
  { value: "delete", label: "Eliminar" },
  { value: "manage", label: "Administrar" },
];

const scopes = [
  { value: "all", label: "Todo" },
  { value: "own", label: "Propio" },
  { value: "assigned", label: "Asignado" },
];

const emptyPermissionForm: PermissionForm = {
  role: "admin",
  module: "dashboard",
  action: "view",
  scope: "all",
  allowed: true,
};

function getLabel(items: Array<{ value: string; label: string }>, value: string) {
  return items.find((item) => item.value === value)?.label || value;
}

function getStatusLabel(status: string | null) {
  if (!status) return "Sin estado";

  const labels: Record<string, string> = {
    activo: "Activo",
    active: "Activo",
    inactivo: "Inactivo",
    inactive: "Inactivo",
    suspendido: "Suspendido",
    suspended: "Suspendido",
  };

  return labels[status] || status;
}

export default function UsuariosPage() {
  const supabase = useMemo(() => createClient(), []);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);

  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [savingPermissionId, setSavingPermissionId] = useState<string | null>(
    null
  );
  const [deletingPermissionId, setDeletingPermissionId] = useState<
    string | null
  >(null);

  const [savingPermission, setSavingPermission] = useState(false);

  const [userSearch, setUserSearch] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [selectedPermissionRole, setSelectedPermissionRole] = useState("all");

  const [permissionForm, setPermissionForm] =
    useState<PermissionForm>(emptyPermissionForm);

  const [message, setMessage] = useState<string | null>(null);

  const filteredProfiles = useMemo(() => {
    const value = userSearch.trim().toLowerCase();

    if (!value) return profiles;

    return profiles.filter((profile) => {
      return (
        profile.full_name?.toLowerCase().includes(value) ||
        profile.email?.toLowerCase().includes(value) ||
        profile.phone?.toLowerCase().includes(value) ||
        profile.role?.toLowerCase().includes(value) ||
        profile.status?.toLowerCase().includes(value)
      );
    });
  }, [profiles, userSearch]);

  const filteredPermissions = useMemo(() => {
    const searchValue = permissionSearch.trim().toLowerCase();

    return permissions.filter((permission) => {
      const matchesSearch =
        !searchValue ||
        permission.role.toLowerCase().includes(searchValue) ||
        permission.module.toLowerCase().includes(searchValue) ||
        permission.action.toLowerCase().includes(searchValue) ||
        permission.scope.toLowerCase().includes(searchValue);

      const matchesRole =
        selectedPermissionRole === "all" ||
        permission.role === selectedPermissionRole;

      return matchesSearch && matchesRole;
    });
  }, [permissions, permissionSearch, selectedPermissionRole]);

  const stats = useMemo(() => {
    return {
      totalUsers: profiles.length,
      admins: profiles.filter((profile) => profile.role === "admin").length,
      supervisors: profiles.filter((profile) => profile.role === "supervisor")
        .length,
      activeUsers: profiles.filter((profile) =>
        ["activo", "active"].includes(profile.status)
      ).length,
      totalPermissions: permissions.length,
      allowedPermissions: permissions.filter((permission) => permission.allowed)
        .length,
    };
  }, [profiles, permissions]);

  const loadProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    setMessage(null);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, role, status")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setProfiles([]);
    } else {
      setProfiles((data || []) as Profile[]);
    }

    setLoadingProfiles(false);
  }, [supabase]);

  const loadPermissions = useCallback(async () => {
    setLoadingPermissions(true);
    setMessage(null);

    const { data, error } = await supabase
      .from("role_permissions")
      .select("id, role, module, action, scope, allowed")
      .order("role", { ascending: true })
      .order("module", { ascending: true })
      .order("action", { ascending: true });

    if (error) {
      setMessage(error.message);
      setPermissions([]);
    } else {
      setPermissions((data || []) as RolePermission[]);
    }

    setLoadingPermissions(false);
  }, [supabase]);

  const loadEverything = useCallback(async () => {
    await Promise.all([loadProfiles(), loadPermissions()]);
  }, [loadProfiles, loadPermissions]);

  const updateRole = useCallback(
    async (userId: string, newRole: string) => {
      setSavingUserId(userId);
      setMessage(null);

      const previousProfiles = profiles;

      setProfiles((currentProfiles) =>
        currentProfiles.map((profile) =>
          profile.id === userId ? { ...profile, role: newRole } : profile
        )
      );

      const { error } = await supabase.rpc("admin_update_user_role", {
        target_user_id: userId,
        new_role: newRole,
      });

      if (error) {
        setProfiles(previousProfiles);
        setMessage(error.message);
      } else {
        setMessage("Rol actualizado correctamente.");
        await loadProfiles();
      }

      setSavingUserId(null);
    },
    [loadProfiles, profiles, supabase]
  );

  const savePermission = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      setSavingPermission(true);
      setMessage(null);

      const { error } = await supabase.from("role_permissions").upsert(
        {
          role: permissionForm.role,
          module: permissionForm.module,
          action: permissionForm.action,
          scope: permissionForm.scope,
          allowed: permissionForm.allowed,
        },
        {
          onConflict: "role,module,action,scope",
        }
      );

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Permiso guardado correctamente.");
        setPermissionForm(emptyPermissionForm);
        await loadPermissions();
      }

      setSavingPermission(false);
    },
    [loadPermissions, permissionForm, supabase]
  );

  const updatePermission = useCallback(
    async (
      permissionId: string,
      patch: Partial<Omit<RolePermission, "id">>
    ) => {
      setSavingPermissionId(permissionId);
      setMessage(null);

      const previousPermissions = permissions;

      setPermissions((currentPermissions) =>
        currentPermissions.map((permission) =>
          permission.id === permissionId
            ? { ...permission, ...patch }
            : permission
        )
      );

      const { error } = await supabase
        .from("role_permissions")
        .update(patch)
        .eq("id", permissionId);

      if (error) {
        setPermissions(previousPermissions);
        setMessage(error.message);
      } else {
        setMessage("Permiso actualizado.");
      }

      setSavingPermissionId(null);
    },
    [permissions, supabase]
  );

  const deletePermission = useCallback(
    async (permissionId: string) => {
      const confirmed = window.confirm(
        "¿Seguro que deseas eliminar este permiso?"
      );

      if (!confirmed) return;

      setDeletingPermissionId(permissionId);
      setMessage(null);

      const { error } = await supabase
        .from("role_permissions")
        .delete()
        .eq("id", permissionId);

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Permiso eliminado correctamente.");
        await loadPermissions();
      }

      setDeletingPermissionId(null);
    },
    [loadPermissions, supabase]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadEverything();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadEverything]);

  return (
    <main className={`${styles.wrapper} ${styles.usersTheme}`}>
      <section className={styles.header}>
        <p className={styles.kicker}>Control de acceso</p>

        <h1 className={styles.title}>Usuarios y roles</h1>

        <p className={styles.description}>
          Administra usuarios, cambia roles y define permisos del CRM desde una
          sola pantalla.
        </p>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-5">
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
          <p className="text-sm font-bold text-slate-400">Usuarios</p>
          <p className="mt-2 text-3xl font-black text-white">
            {stats.totalUsers}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
          <p className="text-sm font-bold text-slate-400">Admins</p>
          <p className="mt-2 text-3xl font-black text-white">{stats.admins}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
          <p className="text-sm font-bold text-slate-400">Supervisores</p>
          <p className="mt-2 text-3xl font-black text-white">
            {stats.supervisors}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
          <p className="text-sm font-bold text-slate-400">Activos</p>
          <p className="mt-2 text-3xl font-black text-white">
            {stats.activeUsers}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
          <p className="text-sm font-bold text-slate-400">Permisos</p>
          <p className="mt-2 text-3xl font-black text-white">
            {stats.totalPermissions}
          </p>
        </div>
      </section>

      {message && (
        <div className="mb-6 rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm font-bold text-blue-100">
          {message}
        </div>
      )}

      <section className={`${styles.content} mb-6`}>
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Usuarios</h2>
            <p className="text-sm text-slate-400">
              Cambia el rol de cada usuario registrado.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Buscar usuario..."
              className="min-w-[260px]"
            />

            <button
              type="button"
              onClick={loadProfiles}
              disabled={loadingProfiles}
            >
              {loadingProfiles ? "Cargando..." : "Actualizar"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Teléfono</th>
                <th>Rol actual</th>
                <th>Cambiar rol</th>
                <th>Estado</th>
              </tr>
            </thead>

            <tbody>
              {loadingProfiles ? (
                <tr>
                  <td colSpan={6}>Cargando usuarios...</td>
                </tr>
              ) : filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={6}>No hay usuarios para mostrar.</td>
                </tr>
              ) : (
                filteredProfiles.map((profile) => (
                  <tr key={profile.id}>
                    <td>
                      <div className="font-black text-white">
                        {profile.full_name || "Sin nombre"}
                      </div>
                    </td>

                    <td>{profile.email || "Sin correo"}</td>

                    <td>{profile.phone || "—"}</td>

                    <td>
                      <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-100">
                        {getLabel(roles, profile.role)}
                      </span>
                    </td>

                    <td>
                      <select
                        value={profile.role}
                        disabled={savingUserId === profile.id}
                        onChange={(event) =>
                          updateRole(profile.id, event.target.value)
                        }
                      >
                        {roles.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>

                      {savingUserId === profile.id && (
                        <p className="mt-2 text-xs font-bold text-slate-400">
                          Guardando...
                        </p>
                      )}
                    </td>

                    <td>
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-100">
                        {getStatusLabel(profile.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${styles.content} mb-6`}>
        <div className="mb-5">
          <h2 className="text-xl font-black text-white">Crear permiso</h2>
          <p className="text-sm text-slate-400">
            Define permisos por rol, módulo, acción y alcance.
          </p>
        </div>

        <form onSubmit={savePermission} className="grid gap-4 md:grid-cols-6">
          <div>
            <label className="mb-2 block text-sm font-black">Rol</label>
            <select
              value={permissionForm.role}
              onChange={(event) =>
                setPermissionForm((current) => ({
                  ...current,
                  role: event.target.value,
                }))
              }
            >
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-black">Módulo</label>
            <select
              value={permissionForm.module}
              onChange={(event) =>
                setPermissionForm((current) => ({
                  ...current,
                  module: event.target.value,
                }))
              }
            >
              {modules.map((module) => (
                <option key={module.value} value={module.value}>
                  {module.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-black">Acción</label>
            <select
              value={permissionForm.action}
              onChange={(event) =>
                setPermissionForm((current) => ({
                  ...current,
                  action: event.target.value,
                }))
              }
            >
              {actions.map((action) => (
                <option key={action.value} value={action.value}>
                  {action.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-black">Alcance</label>
            <select
              value={permissionForm.scope}
              onChange={(event) =>
                setPermissionForm((current) => ({
                  ...current,
                  scope: event.target.value,
                }))
              }
            >
              {scopes.map((scope) => (
                <option key={scope.value} value={scope.value}>
                  {scope.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-black">Permitido</label>
            <select
              value={String(permissionForm.allowed)}
              onChange={(event) =>
                setPermissionForm((current) => ({
                  ...current,
                  allowed: event.target.value === "true",
                }))
              }
            >
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>

          <div className="flex items-end">
            <button type="submit" disabled={savingPermission} className="w-full">
              {savingPermission ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.content}>
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-white">
              Matriz de permisos
            </h2>
            <p className="text-sm text-slate-400">
              Edita permisos existentes sin salir de esta página.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={selectedPermissionRole}
              onChange={(event) => setSelectedPermissionRole(event.target.value)}
              className="min-w-[180px]"
            >
              <option value="all">Todos los roles</option>
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>

            <input
              value={permissionSearch}
              onChange={(event) => setPermissionSearch(event.target.value)}
              placeholder="Buscar permiso..."
              className="min-w-[260px]"
            />

            <button
              type="button"
              onClick={loadPermissions}
              disabled={loadingPermissions}
            >
              {loadingPermissions ? "Cargando..." : "Actualizar"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead>
              <tr>
                <th>Rol</th>
                <th>Módulo</th>
                <th>Acción</th>
                <th>Alcance</th>
                <th>Permitido</th>
                <th>Eliminar</th>
              </tr>
            </thead>

            <tbody>
              {loadingPermissions ? (
                <tr>
                  <td colSpan={6}>Cargando permisos...</td>
                </tr>
              ) : filteredPermissions.length === 0 ? (
                <tr>
                  <td colSpan={6}>No hay permisos para mostrar.</td>
                </tr>
              ) : (
                filteredPermissions.map((permission) => (
                  <tr key={permission.id}>
                    <td>
                      <select
                        value={permission.role}
                        disabled={savingPermissionId === permission.id}
                        onChange={(event) =>
                          updatePermission(permission.id, {
                            role: event.target.value,
                          })
                        }
                      >
                        {roles.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <select
                        value={permission.module}
                        disabled={savingPermissionId === permission.id}
                        onChange={(event) =>
                          updatePermission(permission.id, {
                            module: event.target.value,
                          })
                        }
                      >
                        {modules.map((module) => (
                          <option key={module.value} value={module.value}>
                            {module.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <select
                        value={permission.action}
                        disabled={savingPermissionId === permission.id}
                        onChange={(event) =>
                          updatePermission(permission.id, {
                            action: event.target.value,
                          })
                        }
                      >
                        {actions.map((action) => (
                          <option key={action.value} value={action.value}>
                            {action.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <select
                        value={permission.scope}
                        disabled={savingPermissionId === permission.id}
                        onChange={(event) =>
                          updatePermission(permission.id, {
                            scope: event.target.value,
                          })
                        }
                      >
                        {scopes.map((scope) => (
                          <option key={scope.value} value={scope.value}>
                            {scope.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <select
                        value={String(permission.allowed)}
                        disabled={savingPermissionId === permission.id}
                        onChange={(event) =>
                          updatePermission(permission.id, {
                            allowed: event.target.value === "true",
                          })
                        }
                      >
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </select>
                    </td>

                    <td>
                      <button
                        type="button"
                        disabled={deletingPermissionId === permission.id}
                        onClick={() => deletePermission(permission.id)}
                      >
                        {deletingPermissionId === permission.id
                          ? "Eliminando..."
                          : "Eliminar"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}