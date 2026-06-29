import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { createServiceClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const serviceClient = createServiceClient();
    const body = await req.json();

    const expectedChallenge = req.cookies.get("login_challenge")?.value;
    if (!expectedChallenge) {
      return NextResponse.json({ error: "Missing or expired challenge. Please try again." }, { status: 400 });
    }

    const url = new URL(req.url);
    const rpID = url.hostname;
    const expectedOrigin = `${url.protocol}//${url.host}`;

    // 1. Fetch whitelisted admins list from Supabase
    const { data: { users }, error: listError } = await serviceClient.auth.admin.listUsers();
    if (listError || !users) {
      throw new Error(`Failed to retrieve user accounts: ${listError?.message}`);
    }

    // 2. Identify the admin user who owns this credential ID
    let matchedUser: any = null;
    let matchedPasskey: any = null;

    for (const u of users) {
      const passkeys = u.user_metadata?.passkeys || [];
      const found = passkeys.find((pk: any) => pk.credentialID === body.id);
      if (found) {
        matchedUser = u;
        matchedPasskey = found;
        break;
      }
    }

    if (!matchedUser || !matchedPasskey) {
      return NextResponse.json({ error: "Passkey is not registered to an administrator account." }, { status: 400 });
    }

    // Verify whitelisted email list
    const whitelisted = (process.env.AUTHORIZED_ADMINS || "admin1@pravAI.org,admin2@pravAI.org")
      .split(",")
      .map(e => e.trim().toLowerCase());

    if (!whitelisted.includes(matchedUser.email.toLowerCase())) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    // 3. Verify the biometric signature response
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: matchedPasskey.credentialID,
        publicKey: Buffer.from(matchedPasskey.credentialPublicKey, "base64"),
        counter: matchedPasskey.counter,
        transports: matchedPasskey.transports,
      },
    });

    if (verification.verified && verification.authenticationInfo) {
      const { newCounter } = verification.authenticationInfo;

      // Update counters in database to prevent credential clones
      const updatedPasskeys = matchedUser.user_metadata.passkeys.map((pk: any) => {
        if (pk.credentialID === body.id) {
          return { ...pk, counter: newCounter };
        }
        return pk;
      });

      // Generate a new session token to enforce single active session constraint
      const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      const { error: updateError } = await serviceClient.auth.admin.updateUserById(matchedUser.id, {
        user_metadata: {
          ...matchedUser.user_metadata,
          passkeys: updatedPasskeys,
          session_token: newToken,
        }
      });

      if (updateError) {
        throw new Error(`Failed to update session state: ${updateError.message}`);
      }

      // Generate native Supabase login OTP properties
      const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
        type: "magiclink",
        email: matchedUser.email,
      });

      if (linkError || !linkData?.properties?.email_otp) {
        throw new Error(linkError?.message || "Failed to generate login link properties");
      }

      // Verify OTP server-side to get session tokens
      const { data: authData, error: authError } = await serviceClient.auth.verifyOtp({
        email: matchedUser.email,
        token: linkData.properties.email_otp,
        type: "magiclink",
      });

      if (authError || !authData.session) {
        throw new Error(authError?.message || "Failed to authenticate session");
      }

      const response = NextResponse.json({
        verified: true,
        session: authData.session
      });

      // Set session cookie
      response.cookies.set("session_token", newToken, {
        path: "/",
        maxAge: 86400,
        sameSite: "lax",
      });
      response.cookies.delete("login_challenge");
      return response;
    } else {
      return NextResponse.json({ error: "Biometric verification failed." }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[login-verify] Verification error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
