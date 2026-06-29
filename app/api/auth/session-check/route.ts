import { NextRequest, NextResponse } from "next/server";
import { createServerSideClient, createServiceClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSideClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ active: false });
    }

    const clientToken = req.cookies.get("session_token")?.value;

    const serviceClient = createServiceClient();
    const { data: dbUserData } = await serviceClient.auth.admin.getUserById(user.id);
    const dbToken = dbUserData?.user?.user_metadata?.session_token;

    if (!clientToken || !dbToken || clientToken !== dbToken) {
      return NextResponse.json({ active: false, reason: "concurrent_login" });
    }

    return NextResponse.json({ active: true });
  } catch {
    return NextResponse.json({ active: false });
  }
}
export const dynamic = "force-dynamic";
