import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { createServerSideClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const expectedChallenge = req.cookies.get("reg_challenge")?.value;

    if (!expectedChallenge) {
      return NextResponse.json({ error: "Missing or expired challenge. Please try again." }, { status: 400 });
    }

    const url = new URL(req.url);
    const rpID = url.hostname;
    // Origin must match protocol + host
    const expectedOrigin = `${url.protocol}//${url.host}`;

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;
      const credentialID = credential.id;
      const credentialPublicKey = credential.publicKey;
      const counter = credential.counter;

      const currentMetadata = user.user_metadata || {};
      const newPasskey = {
        credentialID,
        credentialPublicKey: Buffer.from(credentialPublicKey).toString("base64"),
        counter,
        transports: body.response.transports || [],
      };

      // Restrict to exactly one active passkey registration per admin account
      const updatedPasskeys = [newPasskey];

      // Update Supabase Auth user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          ...currentMetadata,
          passkeys: updatedPasskeys
        }
      });

      if (updateError) {
        throw new Error(`Failed to update user profile metadata: ${updateError.message}`);
      }

      const response = NextResponse.json({ verified: true });
      response.cookies.delete("reg_challenge");
      return response;
    } else {
      return NextResponse.json({ error: "Verification failed" }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[register-verify] Verification error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
