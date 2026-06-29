import { createServerSideClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
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

  const whitelisted = (process.env.AUTHORIZED_ADMINS || "admin1@pravAI.org,admin2@pravAI.org")
    .split(",")
    .map(e => e.trim().toLowerCase());

  if (!user || !user.email || !whitelisted.includes(user.email.toLowerCase())) {
    console.warn("[AdminLayout] Unauthorized access in layout — redirecting to /");
    redirect("/");
  }

  const cookieStore = await cookies();
  const clientToken = cookieStore.get("session_token")?.value;

  const { createServiceClient } = await import("@/lib/supabase-server");
  const serviceClient = createServiceClient();
  const { data: dbUserData } = await serviceClient.auth.admin.getUserById(user.id);
  const dbToken = dbUserData?.user?.user_metadata?.session_token;

  if (!clientToken || !dbToken || clientToken !== dbToken) {
    console.warn("[AdminLayout] Session token mismatch in layout — redirecting to /");
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
