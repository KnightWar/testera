import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ── Server client with auth cookie forwarding (Server Components) ───────────
export async function createServerSideClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {}
      },
    },
  });
}

// ── Service-role client — bypasses RLS; for use in API routes only ──────────
// Uses `any` generic so query return types don't become `never` for
// joined selects and partial column selections.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createServiceClient(): ReturnType<typeof createServerClient<any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServerClient<any>(supabaseUrl, supabaseServiceKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
