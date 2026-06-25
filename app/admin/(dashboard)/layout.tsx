import { createServerSideClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSideClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  return (
    <div className="admin-theme min-h-screen flex">
      <AdminNav userEmail={user.email ?? ""} />
      <main className="admin-main-content p-8" style={{ background: "var(--bg-base)" }}>
        {children}
      </main>
    </div>
  );

}
