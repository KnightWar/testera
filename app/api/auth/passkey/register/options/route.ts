import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { createServerSideClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSideClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const whitelisted = (process.env.AUTHORIZED_ADMINS || "admin1@pravAI.org,admin2@pravAI.org")
      .split(",")
      .map(e => e.trim().toLowerCase());

    if (!whitelisted.includes(user.email.toLowerCase())) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    const url = new URL(req.url);
    const rpID = url.hostname;

    const options = await generateRegistrationOptions({
      rpName: "Prav-AI Skill Enhancer",
      rpID,
      userID: Buffer.from(user.id),
      userName: user.email,
      userDisplayName: user.email.split("@")[0],
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "preferred",
      },
    });

    const response = NextResponse.json(options);
    
    // Store challenge in HTTP-only cookie securely for verification
    response.cookies.set("reg_challenge", options.challenge, {
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "lax",
      maxAge: 300, // 5 minutes
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("[register-options] Error generating WebAuthn options:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
