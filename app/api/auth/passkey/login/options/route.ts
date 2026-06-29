import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const rpID = url.hostname;

    // Generate login assertion options
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
    });

    const response = NextResponse.json(options);

    // Save challenge in secure cookie for verification step
    response.cookies.set("login_challenge", options.challenge, {
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "lax",
      maxAge: 300, // 5 minutes
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("[login-options] Error generating options:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
