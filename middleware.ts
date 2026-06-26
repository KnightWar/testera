import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// ⚠️  Force Node.js runtime — Edge runtime lacks crypto APIs used by @supabase/ssr
export const runtime = "nodejs";

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;
  
  // Redirect /admin exactly to /admin/dashboard to prevent 404
  if (pathname === "/admin") {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  // If env vars are missing, allow the request through (Vercel will surface the real error)
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      `[middleware] Missing Supabase env vars — Url present: ${!!supabaseUrl}, Anon key present: ${!!supabaseAnonKey}`
    );
    if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const allCookies = request.cookies.getAll();
        console.log(`[middleware] Cookies count: ${allCookies.length}`);
        return allCookies;
      },
      setAll(cookiesToSet) {
        console.log(`[middleware] Setting cookies:`, cookiesToSet.map(c => c.name));
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh session — do NOT remove this, required for @supabase/ssr
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let user: any = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.warn("[middleware] getUser auth error:", error.message, error.status);
    }
    user = data?.user;
    console.log(`[middleware] getUser result — User ID: ${user?.id || "none"}, Email: ${user?.email || "none"}`);
  } catch (err) {
    console.error("[middleware] getUser exception:", err);
  }

  // Admin routes require an authenticated Supabase user
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !user) {
    console.warn(`[middleware] Unauthorized access to ${pathname} — redirecting to login`);
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  // Redirect authenticated admin users away from the login page to the dashboard
  if (pathname === "/admin/login" && user) {
    console.log("[middleware] Authenticated user on login page — redirecting to dashboard");
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/admin/:path*"],
};
