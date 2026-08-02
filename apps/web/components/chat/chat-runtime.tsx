"use client";

import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const IDLE_TTL_MS = 5 * 60 * 1000;
const EMPTY_BUSY: ReadonlySet<string> = new Set();

type SessionMeta = {
  chat: Chat<UIMessage>;
  visible: boolean;
  idleTimer?: ReturnType<typeof setTimeout>;
  unsubStatus?: () => void;
};

type ChatRuntimeValue = {
  ensureChat: (chatId: string, initialMessages: UIMessage[]) => Chat<UIMessage>;
  getChat: (chatId: string) => Chat<UIMessage> | null;
  hasChat: (chatId: string) => boolean;
  setVisible: (chatId: string, visible: boolean) => void;
  subscribeBusy: (onStoreChange: () => void) => () => void;
  getBusyChatIds: () => ReadonlySet<string>;
};

const ChatRuntimeContext = createContext<ChatRuntimeValue | null>(null);

function collectSignableAddresses(
  wallets: ReturnType<typeof useTurnkey>["wallets"],
): string[] {
  const out: string[] = [];
  for (const w of wallets ?? []) {
    for (const a of w.accounts ?? []) {
      if (a?.address) out.push(String(a.address));
    }
  }
  return out;
}

export function ChatRuntimeProvider({ children }: { children: ReactNode }) {
  const { wallets } = useTurnkey();
  const signableAddressesRef = useRef<string[]>([]);
  const sessionsRef = useRef(new Map<string, SessionMeta>());
  const busyRef = useRef<ReadonlySet<string>>(EMPTY_BUSY);
  const busyListenersRef = useRef(new Set<() => void>());

  useEffect(() => {
    signableAddressesRef.current = collectSignableAddresses(wallets);
  }, [wallets]);

  const notifyBusy = useCallback(() => {
    for (const cb of busyListenersRef.current) cb();
  }, []);

  const syncBusy = useCallback(
    (chatId: string, status: string) => {
      const isBusy = status !== "ready";
      const has = busyRef.current.has(chatId);
      if (isBusy === has) return;
      const next = new Set(busyRef.current);
      if (isBusy) next.add(chatId);
      else next.delete(chatId);
      busyRef.current = next;
      notifyBusy();
    },
    [notifyBusy],
  );

  const dispose = useCallback(
    (chatId: string) => {
      const meta = sessionsRef.current.get(chatId);
      if (!meta) return;
      if (meta.visible || meta.chat.status !== "ready") return;
      meta.unsubStatus?.();
      if (meta.idleTimer) clearTimeout(meta.idleTimer);
      sessionsRef.current.delete(chatId);
      if (busyRef.current.has(chatId)) {
        const next = new Set(busyRef.current);
        next.delete(chatId);
        busyRef.current = next;
        notifyBusy();
      }
    },
    [notifyBusy],
  );

  const scheduleIdleCleanup = useCallback(
    (chatId: string) => {
      const meta = sessionsRef.current.get(chatId);
      if (!meta) return;
      if (meta.idleTimer) clearTimeout(meta.idleTimer);
      if (meta.visible || meta.chat.status !== "ready") return;
      meta.idleTimer = setTimeout(() => dispose(chatId), IDLE_TTL_MS);
    },
    [dispose],
  );

  const ensureChat = useCallback(
    (chatId: string, initialMessages: UIMessage[]) => {
      const existing = sessionsRef.current.get(chatId);
      if (existing) {
        existing.visible = true;
        if (existing.idleTimer) {
          clearTimeout(existing.idleTimer);
          existing.idleTimer = undefined;
        }
        return existing.chat;
      }

      const transport = new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({
          messages,
          id,
          trigger,
          messageId,
        }) => ({
          body: {
            id,
            messages,
            trigger,
            messageId,
            chatId,
            signableAddresses: signableAddressesRef.current,
          },
        }),
      });

      const chat = new Chat<UIMessage>({
        id: chatId,
        messages: initialMessages,
        transport,
      });

      const unsubStatus = chat["~registerStatusCallback"](() => {
        syncBusy(chatId, chat.status);
        const meta = sessionsRef.current.get(chatId);
        if (meta && chat.status === "ready" && !meta.visible) {
          scheduleIdleCleanup(chatId);
        }
      });

      sessionsRef.current.set(chatId, {
        chat,
        visible: true,
        unsubStatus,
      });
      syncBusy(chatId, chat.status);
      return chat;
    },
    [scheduleIdleCleanup, syncBusy],
  );

  const getChat = useCallback(
    (chatId: string) => sessionsRef.current.get(chatId)?.chat ?? null,
    [],
  );

  const hasChat = useCallback(
    (chatId: string) => sessionsRef.current.has(chatId),
    [],
  );

  const setVisible = useCallback(
    (chatId: string, visible: boolean) => {
      const meta = sessionsRef.current.get(chatId);
      if (!meta) return;
      meta.visible = visible;
      if (visible) {
        if (meta.idleTimer) {
          clearTimeout(meta.idleTimer);
          meta.idleTimer = undefined;
        }
      } else {
        scheduleIdleCleanup(chatId);
      }
    },
    [scheduleIdleCleanup],
  );

  const subscribeBusy = useCallback((onStoreChange: () => void) => {
    busyListenersRef.current.add(onStoreChange);
    return () => {
      busyListenersRef.current.delete(onStoreChange);
    };
  }, []);

  const getBusyChatIds = useCallback(() => busyRef.current, []);

  const value = useMemo<ChatRuntimeValue>(
    () => ({
      ensureChat,
      getChat,
      hasChat,
      setVisible,
      subscribeBusy,
      getBusyChatIds,
    }),
    [
      ensureChat,
      getChat,
      hasChat,
      setVisible,
      subscribeBusy,
      getBusyChatIds,
    ],
  );

  return (
    <ChatRuntimeContext.Provider value={value}>
      {children}
    </ChatRuntimeContext.Provider>
  );
}

export function useChatRuntime(): ChatRuntimeValue {
  const ctx = useContext(ChatRuntimeContext);
  if (!ctx) {
    throw new Error("useChatRuntime requires ChatRuntimeProvider");
  }
  return ctx;
}

/** Chat ids currently generating (status !== ready). */
export function useBusyChatIds(): ReadonlySet<string> {
  const { subscribeBusy, getBusyChatIds } = useChatRuntime();
  return useSyncExternalStore(subscribeBusy, getBusyChatIds, () => EMPTY_BUSY);
}
