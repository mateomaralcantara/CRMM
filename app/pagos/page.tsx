import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PaymentModuleFast } from "@/components/payment-module-fast";
import { getCurrentProfile } from "@/lib/auth/current-user";

export default async function Page() {
  const profile = await getCurrentProfile();
  const role = String(profile?.role || "").toLowerCase();

  if (!["super_admin", "admin", "supervisor", "responsable", "vendedor"].includes(role)) {
    redirect("/finanzas");
  }

  return (
    <AppShell>
      <PaymentModuleFast />
    </AppShell>
  );
}
