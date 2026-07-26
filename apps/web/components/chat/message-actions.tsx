"use client";

import { Check, Copy, RotateCcw } from "lucide-react";
import { useState } from "react";

export function MessageActions({
  text,
  onRegenerate,
  showRegenerate,
}: {
  text?: string;
  onRegenerate?: () => void;
  showRegenerate?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/msg:opacity-100 focus-within:opacity-100">
      {text && (
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex size-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Copy"
        >
          {copied ? (
            <Check className="size-3.5 text-emerald-400" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
      )}
      {showRegenerate && onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          className="inline-flex size-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Regenerate"
        >
          <RotateCcw className="size-3.5" />
        </button>
      )}
    </div>
  );
}
