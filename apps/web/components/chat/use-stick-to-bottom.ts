"use client";

import { useCallback, useEffect, useRef } from "react";

/** Auto-scroll only while the user stays near the bottom. */
export function useStickToBottom(deps: unknown[]) {
  const endRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinned.current = distance < 80;
  }, []);

  useEffect(() => {
    if (!pinned.current) return;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { endRef, scrollerRef, onScroll };
}
