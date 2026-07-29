import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function supabasePublicKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    undefined
  );
}

/**
 * Refresh Supabase auth cookies on the request. Must never throw —
 * a failure here becomes a site-wide 500 on every HTML page via proxy.ts.
 */
export async function updateSession(request: NextRequest) {
  const passthrough = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = supabasePublicKey();

  if (!url || !key) {
    console.error(
      "updateSession: missing NEXT_PUBLIC_SUPABASE_URL or publishable/anon key",
    );
    return passthrough;
  }

  try {
    let supabaseResponse = passthrough;

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          if (headers) {
            Object.entries(headers).forEach(([headerKey, value]) =>
              supabaseResponse.headers.set(headerKey, value),
            );
          }
        },
      },
    });

    // Do not run code between createServerClient and getClaims().
    await supabase.auth.getClaims();
    return supabaseResponse;
  } catch (err) {
    console.error("updateSession failed:", err);
    return NextResponse.next({ request });
  }
}
