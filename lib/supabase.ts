import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton to avoid multiple GoTrue instances in Client Components.
// We intentionally use an untyped client here to avoid complex
// Supabase generic inference issues in client components.
// Server-side code uses the typed client from supabase-server.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: ReturnType<typeof createBrowserClient<any>> | null = null;

// ── Browser client (for use in Client Components) ──────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(): ReturnType<typeof createBrowserClient<any>> {
  if (!client) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client = createBrowserClient<any>(supabaseUrl, supabaseAnonKey);
  }
  return client;
}
