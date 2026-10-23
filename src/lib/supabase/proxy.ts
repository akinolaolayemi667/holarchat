import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { tryGetSupabasePublicEnv } from "./env";

/**
 * Public (no account required): /, /demo, /login, /signup, /auth/*
 * Protected: /chat — real authenticated messaging only
 *
 * Guests trying to open /chat are sent to the app preview (/demo),
 * not forced through signup first.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const env = tryGetSupabasePublicEnv();
  if (!env) {
    return supabaseResponse;
  }
  const { url, key } = env;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([headerKey, value]) =>
          supabaseResponse.headers.set(headerKey, value),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  const pathname = request.nextUrl.pathname;

  const isProtected = pathname.startsWith("/chat");

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/demo";
    redirectUrl.searchParams.set("guest", "1");
    return NextResponse.redirect(redirectUrl);
  }

  // Signed-in users don't need the auth screens.
  if (user && (pathname.startsWith("/login") || pathname.startsWith("/signup"))) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/chat";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
