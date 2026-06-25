import { createServerSideClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSideClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  return (
    <div className="min-h-screen flex">
      <AdminNav userEmail={user.email ?? ""} />
      <main className="flex-1 ml-64 p-8 min-h-screen" style={{ background: "var(--bg-base)" }}>
        {children}
      </main>
    </div>
  );
}
