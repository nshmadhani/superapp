import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createDb } from "@ervo/db";

export const AUTH_COOKIE = "ervo_user_id";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function authCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

export async function getAuthUserId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(AUTH_COOKIE)?.value ?? null;
}

export async function requireAuthUserId(): Promise<string> {
  const id = await getAuthUserId();
  if (!id) throw new AuthError("unauthorized");
  return id;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/** Prefer attaching the cookie to the Route Handler response (reliable with Proxy). */
export function applyAuthCookie(res: NextResponse, userId: string): void {
  res.cookies.set(AUTH_COOKIE, userId, authCookieOptions());
}

export function clearAuthCookie(res: NextResponse): void {
  res.cookies.set(AUTH_COOKIE, "", {
    ...authCookieOptions(),
    maxAge: 0,
  });
}

/** @deprecated Prefer applyAuthCookie on the Response — cookies().set can be dropped by Proxy. */
export async function setAuthUserId(userId: string) {
  const jar = await cookies();
  jar.set(AUTH_COOKIE, userId, authCookieOptions());
}

export async function clearAuthUserId() {
  const jar = await cookies();
  jar.set(AUTH_COOKIE, "", { ...authCookieOptions(), maxAge: 0 });
}

export type SyncAuthInput = {
  turnkeyUserId: string;
  turnkeySuborgId: string;
  email?: string | null;
};

export function formatUnknownError(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as {
      message?: unknown;
      error?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    const parts = [o.message, o.error, o.code, o.details, o.hint]
      .map((p) => (typeof p === "string" ? p : null))
      .filter(Boolean);
    if (parts.length) return parts.join(" · ");
    try {
      return JSON.stringify(err);
    } catch {
      return "unknown_error";
    }
  }
  return "unknown_error";
}

/**
 * Upserts Ervo user keyed by Turnkey sub-org.
 * Supabase Auth mirroring is best-effort and must not block login.
 */
export async function syncTurnkeyUser(input: SyncAuthInput): Promise<{
  userId: string;
  email: string | null;
}> {
  const db = createDb();
  const email =
    input.email?.trim() ||
    `${input.turnkeySuborgId.replace(/-/g, "").slice(0, 24)}@users.ervo.local`;

  const { data: existing, error: selectErr } = await db
    .from("users")
    .select("id, email")
    .eq("turnkey_suborg_id", input.turnkeySuborgId)
    .maybeSingle();
  if (selectErr) {
    throw new Error(`users_select: ${formatUnknownError(selectErr)}`);
  }

  let userId: string;

  if (existing?.id) {
    userId = existing.id as string;
    const { error: updateErr } = await db
      .from("users")
      .update({
        turnkey_user_id: input.turnkeyUserId,
        email: input.email ?? existing.email,
      })
      .eq("id", userId);
    if (updateErr) {
      throw new Error(`users_update: ${formatUnknownError(updateErr)}`);
    }
  } else {
    const { data: inserted, error: insertErr } = await db
      .from("users")
      .insert({
        turnkey_user_id: input.turnkeyUserId,
        turnkey_suborg_id: input.turnkeySuborgId,
        email: input.email ?? email,
      })
      .select("id")
      .single();
    if (insertErr) {
      throw new Error(`users_insert: ${formatUnknownError(insertErr)}`);
    }
    if (!inserted?.id) throw new Error("users_insert: missing id");
    userId = inserted.id as string;
  }

  // Mirror into Supabase Auth — optional; cookie auth only needs public.users.
  try {
    const { data: byId } = await db.auth.admin.getUserById(userId);
    if (byId?.user) {
      await db.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...byId.user.user_metadata,
          turnkey_user_id: input.turnkeyUserId,
          turnkey_suborg_id: input.turnkeySuborgId,
        },
      });
    } else {
      const { error: createErr } = await db.auth.admin.createUser({
        id: userId,
        email,
        email_confirm: true,
        user_metadata: {
          turnkey_user_id: input.turnkeyUserId,
          turnkey_suborg_id: input.turnkeySuborgId,
        },
      });
      if (
        createErr &&
        !/already|registered|exists/i.test(createErr.message ?? "")
      ) {
        console.error("supabase auth createUser", createErr.message);
      }
    }
  } catch (authErr) {
    console.error("supabase auth mirror skipped:", formatUnknownError(authErr));
  }

  return { userId, email: input.email ?? email };
}
