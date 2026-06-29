import { createServerSideClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import AdminInactivityTimeout from "@/components/admin/AdminInactivityTimeout";

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

  if (!user || !user.email?.endsWith("@socse.edu")) {
    console.warn("[AdminLayout] Unauthorized access in layout — redirecting to /");
    redirect("/");
  }

  return (
    <div className="pl-[220px] min-h-screen bg-[--bg-base]">
      <AdminNav userEmail={user.email ?? ""} />
      <AdminInactivityTimeout />
      <main className="max-w-[1200px] mx-auto px-8 py-8 page-enter">
        {children}
      </main>
    </div>
  );
}
