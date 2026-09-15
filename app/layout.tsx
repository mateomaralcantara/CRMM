import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/current-user";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, profile] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
  ]);

  const isActiveUser =
    user && ["activo", "active"].includes(String(profile?.status));

  return (
    <html lang="es">
      <body className="bg-slate-950 text-slate-100">
        {isActiveUser ? (
          <div className="flex min-h-screen bg-slate-950">
            <Sidebar role={profile?.role} />

            <main className="min-w-0 flex-1 overflow-x-hidden pt-16 lg:pt-0">
              {children}
            </main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
