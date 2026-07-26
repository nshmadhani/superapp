"use client";

import { CIPHER_AUTHED_EVENT } from "@/components/auth-sync";

/** Wait until Cipher cookie session exists (Turnkey → Supabase sync done). */
export async function waitForCipherSession(timeoutMs = 15_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const data = await res.json();
      if (data.user?.id) return true;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

export function onCipherAuthed(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(CIPHER_AUTHED_EVENT, handler);
  return () => window.removeEventListener(CIPHER_AUTHED_EVENT, handler);
}
