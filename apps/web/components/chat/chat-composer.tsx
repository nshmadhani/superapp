"use client";

import { ArrowUp, Loader2, Square } from "lucide-react";
import {
  useLayoutEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent,
} from "react";

const MAX_TEXTAREA_PX = 160;

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  disabled,
  placeholder = "Message Cipher…",
  error,
  footer = "Cipher can make mistakes. Review plans before executing.",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (text: string) => void;
  onStop?: () => void;
  busy?: boolean;
  disabled?: boolean;
  placeholder?: string;
  error?: string | null;
  footer?: string | null;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 28), MAX_TEXTAREA_PX)}px`;
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_PX ? "auto" : "hidden";
  }, [value]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || busy || disabled) return;
    onSubmit(trimmed);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent px-4 pb-3 pt-8">
      <div className="pointer-events-auto mx-auto w-full max-w-[57.6rem]">
        <div className="mx-auto w-[90%]">
        {error && (
          <p className="mb-2 text-center text-sm text-red-400">{error}</p>
        )}
        <form
          className="flex items-end gap-1 rounded-full border border-zinc-800 bg-zinc-900/80 p-1 shadow-lg shadow-black/40 backdrop-blur"
          onSubmit={submit}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={placeholder}
            disabled={disabled}
            className="cipher-scroll max-h-40 min-h-7 flex-1 resize-none overflow-hidden bg-transparent px-3 py-1.5 text-sm leading-[1.25rem] text-zinc-100 outline-none placeholder:text-zinc-600 disabled:opacity-50"
          />
          {busy && onStop ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop generating"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-950 transition hover:bg-white"
            >
              <Square className="size-2.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={busy || disabled || !value.trim()}
              aria-label="Send"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-950 transition-opacity hover:bg-white disabled:opacity-30"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowUp className="size-3.5" />
              )}
            </button>
          )}
        </form>
        {footer && (
          <p className="mt-1.5 text-center text-[10px] text-zinc-600">{footer}</p>
        )}
        </div>
      </div>
    </div>
  );
}
