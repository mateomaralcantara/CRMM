import { redirect } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-slate-950">
      <Topbar email={user.email} />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] p-5 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
