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

/**
 * Upserts Ervo user + Supabase Auth user keyed by Turnkey sub-org.
 * Does not set cookies — the Route Handler must call applyAuthCookie.
 */
export async function syncTurnkeyUser(input: SyncAuthInput): Promise<{
  userId: string;
  email: string | null;
}> {
  const db = createDb();
  const email =
    input.email?.trim() ||
    `${input.turnkeySuborgId.replace(/-/g, "").slice(0, 24)}@users.ervo.local`;

  const { data: existing } = await db
    .from("users")
    .select("id, email")
    .eq("turnkey_suborg_id", input.turnkeySuborgId)
    .maybeSingle();

  let userId: string;

  if (existing?.id) {
    userId = existing.id as string;
    await db
      .from("users")
      .update({
        turnkey_user_id: input.turnkeyUserId,
        email: input.email ?? existing.email,
      })
      .eq("id", userId);
  } else {
    const { data: inserted, error } = await db
      .from("users")
      .insert({
        turnkey_user_id: input.turnkeyUserId,
        turnkey_suborg_id: input.turnkeySuborgId,
        email: input.email ?? email,
      })
      .select("id")
      .single();
    if (error) throw error;
    userId = inserted.id as string;
  }

  // Mirror into Supabase Auth (service role)
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const authUser = list?.users?.find(
    (u: { id: string; email?: string; user_metadata?: Record<string, unknown> }) =>
      u.id === userId ||
      u.user_metadata?.turnkey_suborg_id === input.turnkeySuborgId ||
      u.email === email,
  );

  if (!authUser) {
    const { error: createErr } = await db.auth.admin.createUser({
      id: userId,
      email,
      email_confirm: true,
      user_metadata: {
        turnkey_user_id: input.turnkeyUserId,
        turnkey_suborg_id: input.turnkeySuborgId,
      },
    });
    // ignore duplicate if race
    if (createErr && !createErr.message.includes("already")) {
      console.error("supabase auth createUser", createErr.message);
    }
  } else {
    await db.auth.admin.updateUserById(authUser.id, {
      user_metadata: {
        ...authUser.user_metadata,
        turnkey_user_id: input.turnkeyUserId,
        turnkey_suborg_id: input.turnkeySuborgId,
      },
    });
    if (authUser.id !== userId) {
      // prefer auth user id as canonical if mismatch
      userId = authUser.id;
    }
  }

  return { userId, email: input.email ?? email };
}
