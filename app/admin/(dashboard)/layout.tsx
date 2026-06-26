import { createServerSideClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSideClient();
  
  let user: any = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.warn("[AdminLayout] getUser auth error:", error.message, error.status);
    }
    user = data?.user;
    console.log(`[AdminLayout] getUser result — User ID: ${user?.id || "none"}, Email: ${user?.email || "none"}`);
  } catch (err) {
    console.error("[AdminLayout] getUser exception:", err);
  }

  if (!user) {
    console.warn("[AdminLayout] Unauthorized access in layout — redirecting to /admin/login");
    redirect("/admin/login");
  }

  return (
    <div className="admin-theme min-h-screen flex">
      <AdminNav userEmail={user.email ?? ""} />
      <main className="admin-main-content p-8" style={{ background: "var(--bg-base)" }}>
        {children}
      </main>
    </div>
  );

}
