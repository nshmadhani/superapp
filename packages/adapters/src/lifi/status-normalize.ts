/**
 * LI.FI often returns status=DONE with substatus=REFUNDED when a bridge
 * deposit is returned on the source chain (looks like HYPE→HYPE on scan).
 * Treat that as a failed terminal outcome for product UX.
 */
export type LifiTerminalKind =
  | "pending"
  | "success"
  | "failed"
  | "refunded"
  | "partial"
  | "unknown";

export function normalizeLifiTerminal(opts: {
  status?: string | null;
  substatus?: string | null;
}): {
  kind: LifiTerminalKind;
  /** Status string for UI (prefers substatus when it is the real outcome). */
  uiStatus: string;
} {
  const status = (opts.status ?? "").toUpperCase();
  const sub = (opts.substatus ?? "").toUpperCase();

  if (sub === "REFUNDED" || status === "REFUNDED") {
    return { kind: "refunded", uiStatus: "REFUNDED" };
  }
  if (sub === "PARTIAL" || status === "PARTIAL") {
    return { kind: "partial", uiStatus: "PARTIAL" };
  }
  if (status === "DONE" && (!sub || sub === "COMPLETED" || sub === "DONE")) {
    return { kind: "success", uiStatus: "DONE" };
  }
  if (status === "DONE") {
    // DONE with an unexpected substatus — surface the substatus.
    return {
      kind: sub.includes("FAIL") ? "failed" : "unknown",
      uiStatus: sub || "DONE",
    };
  }
  if (status === "FAILED" || status === "INVALID") {
    return { kind: "failed", uiStatus: status };
  }
  if (
    status === "PENDING" ||
    status === "NOT_FOUND" ||
    status === "" ||
    !status
  ) {
    return { kind: "pending", uiStatus: status || "PENDING" };
  }
  return { kind: "unknown", uiStatus: status };
}
