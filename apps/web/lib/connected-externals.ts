"use client";

export type ConnectedExternal = {
  address: string;
  chainFamily: "evm" | "solana";
  label: string;
  providerId: "injected-evm" | "phantom-solana";
};

const STORAGE_KEY = "ervo:connected-externals";

let memory: ConnectedExternal[] = [];

function readStorage(): ConnectedExternal[] {
  if (typeof window === "undefined") return memory;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return memory;
    const parsed = JSON.parse(raw) as ConnectedExternal[];
    if (!Array.isArray(parsed)) return memory;
    memory = parsed;
    return memory;
  } catch {
    return memory;
  }
}

function writeStorage(entries: ConnectedExternal[]) {
  memory = entries;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore quota / private mode
  }
}

function addressesMatch(a: string, b: string): boolean {
  if (a.startsWith("0x") || b.startsWith("0x")) {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}

/** Upsert a live external connection (session-scoped). */
export function setConnectedExternal(entry: ConnectedExternal): void {
  const prev = readStorage();
  const next = [
    entry,
    ...prev.filter((e) => !addressesMatch(e.address, entry.address)),
  ];
  writeStorage(next);
}

export function getConnectedExternals(): ConnectedExternal[] {
  return [...readStorage()];
}

export function clearConnectedExternal(address: string): void {
  writeStorage(
    readStorage().filter((e) => !addressesMatch(e.address, address)),
  );
}

export function clearAllConnectedExternals(): void {
  writeStorage([]);
}
