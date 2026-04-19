"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  created_at: string;
};

const roles = [
  "admin",
  "supervisor",
  "vendedor",
  "responsable",
  "soporte",
  "afiliado",
  "cliente",
];

const statuses = ["activo", "inactivo", "suspendido"];

const roleLabels: Record<string, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  vendedor: "Vendedor",
  responsable: "Responsable",
  soporte: "Soporte",
  afiliado: "Afiliado",
  cliente: "Cliente",
};

const statusLabels: Record<string, string> = {
  activo: "Activo",
  inactivo: "Inactivo",
  suspendido: "Suspendido",
};

export default function UsuariosClient({
  initialProfiles,
  currentUserId,
}: {
  initialProfiles: Profile[];
  currentUserId: string;
}) {
  const supabase = createClient();

  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filteredProfiles = useMemo(() => {
    return profiles.filter((profile) => {
      const query = search.toLowerCase().trim();

      const matchesSearch =
        !query ||
        profile.full_name?.toLowerCase().includes(query) ||
        profile.email?.toLowerCase().includes(query) ||
        profile.phone?.toLowerCase().includes(query);

      const matchesRole =
        roleFilter === "todos" || profile.role === roleFilter;

      const matchesStatus =
        statusFilter === "todos" || profile.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [profiles, search, roleFilter, statusFilter]);

  async function updateUserProfile(
    userId: string,
    newRole: string,
    newStatus: string
  ) {
    setSavingUserId(userId);
    setMessage(null);

    const { error } = await supabase.rpc("admin_update_user_profile", {
      target_user_id: userId,
      new_role: newRole,
      new_status: newStatus,
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
      setSavingUserId(null);
      return;
    }

    setProfiles((current) =>
      current.map((profile) =>
        profile.id === userId
          ? {
              ...profile,
              role: newRole,
              status: newStatus,
            }
          : profile
      )
    );

    setMessage("Usuario actualizado correctamente.");
    setSavingUserId(null);
  }

  function getRoleCount(role: string) {
    return profiles.filter((profile) => profile.role === role).length;
  }

  return (
    <main className="space-y-6 p-6">
      <section className="flex flex-col gap-4 rounded-2xl border bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Administración
          </p>
          <h1 className="text-2xl font-bold text-slate-950">
            Usuarios y roles
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Controla quién puede ver, editar, asignar, aprobar y operar dentro
            del CRM.
          </p>
        </div>

        <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white">
          <p className="text-sm text-slate-300">Total usuarios</p>
          <p className="text-3xl font-bold">{profiles.length}</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Admins</p>
          <p className="text-2xl font-bold">{getRoleCount("admin")}</p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Responsables</p>
          <p className="text-2xl font-bold">{getRoleCount("responsable")}</p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Afiliados</p>
          <p className="text-2xl font-bold">{getRoleCount("afiliado")}</p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Clientes</p>
          <p className="text-2xl font-bold">{getRoleCount("cliente")}</p>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, correo o teléfono..."
            className="rounded-xl border px-4 py-3 text-sm outline-none focus:border-slate-900"
          />

          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="rounded-xl border px-4 py-3 text-sm outline-none focus:border-slate-900"
          >
            <option value="todos">Todos los roles</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border px-4 py-3 text-sm outline-none focus:border-slate-900"
          >
            <option value="todos">Todos los estados</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </div>

        {message && (
          <div className="mt-4 rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="p-4">Usuario</th>
                <th className="p-4">Contacto</th>
                <th className="p-4">Rol</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Creado</th>
                <th className="p-4">Acción</th>
              </tr>
            </thead>

            <tbody>
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td className="p-6 text-slate-500" colSpan={6}>
                    No hay usuarios con esos filtros.
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((profile) => {
                  const isCurrentUser = profile.id === currentUserId;
                  const isSaving = savingUserId === profile.id;

                  return (
                    <UserRow
                      key={profile.id}
                      profile={profile}
                      isCurrentUser={isCurrentUser}
                      isSaving={isSaving}
                      onSave={updateUserProfile}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function UserRow({
  profile,
  isCurrentUser,
  isSaving,
  onSave,
}: {
  profile: Profile;
  isCurrentUser: boolean;
  isSaving: boolean;
  onSave: (userId: string, role: string, status: string) => Promise<void>;
}) {
  const [selectedRole, setSelectedRole] = useState(profile.role);
  const [selectedStatus, setSelectedStatus] = useState(profile.status);

  const hasChanges =
    selectedRole !== profile.role || selectedStatus !== profile.status;

  const createdDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("es-DO")
    : "-";

  return (
    <tr className="border-t align-middle">
      <td className="p-4">
        <div>
          <div className="font-semibold text-slate-950">
            {profile.full_name || "Sin nombre"}
          </div>
          <div className="text-xs text-slate-500">
            {isCurrentUser ? "Tu usuario actual" : profile.id}
          </div>
        </div>
      </td>

      <td className="p-4">
        <div className="text-slate-700">{profile.email || "-"}</div>
        <div className="text-xs text-slate-500">{profile.phone || "-"}</div>
      </td>

      <td className="p-4">
        <select
          value={selectedRole}
          disabled={isCurrentUser || isSaving}
          onChange={(event) => setSelectedRole(event.target.value)}
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-slate-900 disabled:bg-slate-100"
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {roleLabels[role]}
            </option>
          ))}
        </select>
      </td>

      <td className="p-4">
        <select
          value={selectedStatus}
          disabled={isCurrentUser || isSaving}
          onChange={(event) => setSelectedStatus(event.target.value)}
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-slate-900 disabled:bg-slate-100"
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
      </td>

      <td className="p-4 text-slate-500">{createdDate}</td>

      <td className="p-4">
        <button
          disabled={!hasChanges || isCurrentUser || isSaving}
          onClick={() => onSave(profile.id, selectedRole, selectedStatus)}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSaving ? "Guardando..." : "Guardar"}
        </button>
      </td>
    </tr>
  );
}