/** Clean user-facing wallet name (no chain · address clutter / date suffixes). */
export function cleanWalletName(raw?: string | null): string {
  let name = (raw ?? "").trim();
  if (!name) return "";
  name = name.replace(/\s*[·•|]\s*(EVM|Solana|SOL)\s*$/i, "").trim();
  name = name
    .replace(/\s+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s*$/g, "")
    .trim();
  return name;
}

export function walletDisplayName(w: {
  label?: string | null;
  source?: string;
}): string {
  const cleaned = cleanWalletName(w.label);
  if (cleaned) return cleaned;
  if (w.source === "turnkey") return "Ervo";
  if (w.source === "external") return "Connected";
  return "Wallet";
}
