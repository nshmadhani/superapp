import { clearAuthUserId } from "@/lib/auth";

export async function POST() {
  await clearAuthUserId();
  return Response.json({ ok: true });
}
