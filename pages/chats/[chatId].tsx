import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { Socket } from "socket.io-client";
import { useToast } from "@/components/ui/toast-provider";
import {
  CLAIM_CHAT_MUTATION,
  CLOSE_CHAT_MUTATION,
  GET_CHAT_QUERY,
  MARK_CHAT_MESSAGES_AS_READ_MUTATION,
  SEND_MESSAGE_MUTATION,
} from "@/graphql/chat.gql";
import { getAccessToken, getSessionMember } from "@/lib/auth/session";
import { createChatSocket } from "@/lib/socket/chat";
import { usePageVisible } from "@/lib/hooks/use-page-visible";
import { confirmAction, confirmDanger, errorAlert, successAlert } from "@/lib/ui/alerts";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  ClaimChatMutationData,
  ClaimChatMutationVars,
  CloseChatMutationData,
  CloseChatMutationVars,
  GetChatQueryData,
  GetChatQueryVars,
  MarkChatMessagesAsReadMutationData,
  MarkChatMessagesAsReadMutationVars,
  MessageDto,
  SendMessageMutationData,
  SendMessageMutationVars,
} from "@/types/chat";
import type { NextPageWithAuth } from "@/types/page";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Download,
  File,
  MessageSquare,
  Send,
  Wifi,
  WifiOff,
} from "lucide-react";

// ─── Hotel title query ────────────────────────────────────────────────────────

const GET_HOTEL_TITLE_QUERY = gql`
  query GetHotelTitleForChat($hotelId: String!) {
    getHotel(hotelId: $hotelId) {
      _id
      hotelTitle
      hotelLocation
    }
  }
`;

interface HotelTitleResult {
  getHotel: { _id: string; hotelTitle: string; hotelLocation: string };
}

// ─── Socket types ─────────────────────────────────────────────────────────────

interface SocketAck {
  success: boolean;
  error?: string;
}

interface ChatRoomEventPayload {
  chatId: string;
}

interface TypingEventPayload extends ChatRoomEventPayload {
  userId: string;
}

// ─── Avatar color helper ──────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-teal-500",
];

function avatarBg(id: string): string {
  return AVATAR_COLORS[id.charCodeAt(id.length - 1) % AVATAR_COLORS.length];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const logBackgroundChatError = (context: string, error: unknown): void => {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[Chat] ${context}: ${getErrorMessage(error)}`);
  }
};

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Seoul",
  });
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 py-1">
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-400"
        aria-hidden
      >
        H
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-slate-100 bg-white px-3.5 py-2.5 shadow-sm">
        {[0, 160, 320].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300"
            style={{ animationDelay: `${delay}ms`, animationDuration: "1s" }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isOwn,
  showTime,
  isLastInGroup,
}: {
  message: MessageDto;
  isOwn: boolean;
  showTime: boolean;
  isLastInGroup: boolean;
}) {
  const time = formatMessageTime(message.timestamp);

  // Tail only on last message in a group for a more modern look
  const sentCls = `bg-sky-500 text-white ${isLastInGroup ? "rounded-2xl rounded-br-md" : "rounded-2xl"}`;
  const recvCls = `bg-white text-slate-900 border border-slate-100 shadow-sm ${isLastInGroup ? "rounded-2xl rounded-bl-md" : "rounded-2xl"}`;

  return (
    <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
      <div
        className={`relative max-w-[78%] overflow-hidden sm:max-w-[68%] ${isOwn ? sentCls : recvCls}`}
      >
        {/* IMAGE */}
        {message.messageType === "IMAGE" && message.imageUrl && (
          <a href={message.imageUrl} target="_blank" rel="noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.imageUrl}
              alt="Shared image"
              className="block max-h-64 w-full object-cover"
            />
          </a>
        )}

        {/* FILE */}
        {message.messageType === "FILE" && message.fileUrl && (
          <a
            href={message.fileUrl}
            download
            target="_blank"
            rel="noreferrer"
            className={`flex items-center gap-3 px-4 py-3 transition ${
              isOwn ? "hover:bg-white/10" : "hover:bg-slate-50"
            }`}
          >
            <div
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                isOwn ? "bg-white/20" : "bg-sky-50"
              }`}
            >
              <File size={16} className={isOwn ? "text-white" : "text-sky-600"} />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={`truncate text-sm font-medium ${
                  isOwn ? "text-white" : "text-slate-800"
                }`}
              >
                {message.fileUrl.split("/").pop() ?? "Download file"}
              </p>
              <p className={`text-xs ${isOwn ? "text-white/60" : "text-slate-400"}`}>
                Attachment
              </p>
            </div>
            <Download size={13} className={isOwn ? "text-white/60" : "text-slate-400"} />
          </a>
        )}

        {/* TEXT */}
        {message.messageType === "TEXT" && (
          <p
            className={`break-words px-3.5 py-2.5 text-sm leading-relaxed ${
              showTime ? "pb-1.5" : ""
            }`}
          >
            {message.content}
          </p>
        )}

        {/* Timestamp + read receipt */}
        {showTime && (
          <div
            className={`flex items-center gap-1 px-3.5 pb-2 ${
              isOwn ? "justify-end" : "justify-start"
            }`}
          >
            <span className={`text-[10px] ${isOwn ? "text-white/60" : "text-slate-400"}`}>
              {time}
            </span>
            {isOwn &&
              (message.read ? (
                <CheckCheck size={11} className="text-white/80" />
              ) : (
                <Check size={11} className="text-white/50" />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ChatThreadPage: NextPageWithAuth = () => {
  const router = useRouter();
  const toast = useToast();
  const member = useMemo(() => getSessionMember(), []);
  const isPageVisible = usePageVisible();
  const memberType = member?.memberType;
  const isUser = memberType === "USER";
  const isOperatorSide = !isUser;
  const isAgent = memberType === "AGENT";
  const chatId =
    typeof router.query.chatId === "string" ? router.query.chatId : "";

  const [messageInput, setMessageInput] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastMarkedKeyRef = useRef("");
  const socketRef = useRef<Socket | null>(null);
  const remoteTypingTimeoutRef = useRef<number | null>(null);
  const localTypingTimeoutRef = useRef<number | null>(null);
  const localTypingSentRef = useRef(false);
  const socketJoinFailedRef = useRef(false);
  const lastEventRefetchAtRef = useRef(0);
  const queuedEventRefetchTimeoutRef = useRef<number | null>(null);
  // Track count to know which messages are "new" (for entry animation)
  const prevMessageCountRef = useRef(0);

  /** QUERIES **/

  const { data, loading, error, refetch, startPolling, stopPolling } = useQuery<
    GetChatQueryData,
    GetChatQueryVars
  >(GET_CHAT_QUERY, {
    skip: !chatId,
    variables: { chatId },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const chat = data?.getChat;

  const { data: hotelData } = useQuery<HotelTitleResult>(GET_HOTEL_TITLE_QUERY, {
    skip: !chat?.hotelId,
    variables: { hotelId: chat?.hotelId ?? "" },
    fetchPolicy: "cache-and-network",
  });

  const [sendMessage, { loading: sending }] = useMutation<
    SendMessageMutationData,
    SendMessageMutationVars
  >(SEND_MESSAGE_MUTATION);

  const [markRead] = useMutation<
    MarkChatMessagesAsReadMutationData,
    MarkChatMessagesAsReadMutationVars
  >(MARK_CHAT_MESSAGES_AS_READ_MUTATION);

  const [claimChat, { loading: claiming }] = useMutation<
    ClaimChatMutationData,
    ClaimChatMutationVars
  >(CLAIM_CHAT_MUTATION);

  const [closeChat, { loading: closing }] = useMutation<
    CloseChatMutationData,
    CloseChatMutationVars
  >(CLOSE_CHAT_MUTATION);

  /** EFFECTS **/

  const unreadForMe = chat
    ? isUser
      ? chat.unreadGuestMessages
      : chat.unreadAgentMessages
    : 0;

  // Auto mark-as-read
  useEffect(() => {
    if (!chat || unreadForMe === 0) return;
    const markKey = `${chat._id}:${chat.messages.length}:${unreadForMe}`;
    if (lastMarkedKeyRef.current === markKey) return;
    lastMarkedKeyRef.current = markKey;
    void markRead({ variables: { chatId: chat._id } }).catch((e: unknown) => {
      logBackgroundChatError("mark-as-read", e);
    });
  }, [chat, markRead, unreadForMe]);

  // Fallback polling when socket disconnected
  useEffect(() => {
    if (!chatId || socketConnected || !isPageVisible) {
      stopPolling();
      return;
    }
    startPolling(30000);
    return () => {
      stopPolling();
    };
  }, [chatId, isPageVisible, socketConnected, startPolling, stopPolling]);

  // Refetch on visibility restore (no socket)
  useEffect(() => {
    if (!chatId || socketConnected || !isPageVisible) return;
    void refetch();
  }, [chatId, isPageVisible, refetch, socketConnected]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages.length]);

  // Track previous message count for animation
  useEffect(() => {
    prevMessageCountRef.current = chat?.messages.length ?? 0;
  }, [chat?.messages.length]);

  // Socket setup
  useEffect(() => {
    if (!chatId || !isPageVisible) return;
    const token = getAccessToken();
    if (!token) return;

    const socket = createChatSocket(token);
    socketRef.current = socket;
    socketJoinFailedRef.current = false;

    const requestRefetch = (): void => {
      const nowMs = Date.now();
      const elapsedMs = nowMs - lastEventRefetchAtRef.current;
      const minIntervalMs = 800;
      if (elapsedMs >= minIntervalMs) {
        lastEventRefetchAtRef.current = nowMs;
        void refetch();
        return;
      }
      if (queuedEventRefetchTimeoutRef.current !== null) return;
      const waitMs = minIntervalMs - elapsedMs;
      queuedEventRefetchTimeoutRef.current = window.setTimeout(() => {
        queuedEventRefetchTimeoutRef.current = null;
        lastEventRefetchAtRef.current = Date.now();
        void refetch();
      }, waitMs);
    };

    const clearRemoteTyping = () => {
      if (remoteTypingTimeoutRef.current) {
        window.clearTimeout(remoteTypingTimeoutRef.current);
        remoteTypingTimeoutRef.current = null;
      }
      setTypingUserId(null);
    };

    const onConnect = () => {
      setSocketConnected(true);
      socket.emit("authenticate", { token }, (authAck?: SocketAck) => {
        if (!authAck?.success) {
          if (!socketJoinFailedRef.current) {
            toast.info(authAck?.error ?? "Realtime auth failed. Using polling fallback.");
            socketJoinFailedRef.current = true;
          }
          return;
        }
        socket.emit("joinChat", { chatId }, (joinAck?: SocketAck) => {
          if (!joinAck?.success && !socketJoinFailedRef.current) {
            toast.info(joinAck?.error ?? "Realtime join failed. Using polling fallback.");
            socketJoinFailedRef.current = true;
            return;
          }
          requestRefetch();
        });
      });
    };

    const onDisconnect = () => {
      setSocketConnected(false);
      clearRemoteTyping();
    };
    const onConnectError = () => {
      setSocketConnected(false);
    };

    const onRoomEvent = (payload: ChatRoomEventPayload) => {
      if (!payload?.chatId || payload.chatId !== chatId) return;
      requestRefetch();
    };

    const onUserTyping = (payload: TypingEventPayload) => {
      if (!payload?.chatId || payload.chatId !== chatId) return;
      if (!payload.userId || payload.userId === member?._id) return;
      setTypingUserId(payload.userId);
      if (remoteTypingTimeoutRef.current)
        window.clearTimeout(remoteTypingTimeoutRef.current);
      remoteTypingTimeoutRef.current = window.setTimeout(() => {
        setTypingUserId(null);
        remoteTypingTimeoutRef.current = null;
      }, 2000);
    };

    const onUserStopTyping = (payload: TypingEventPayload) => {
      if (!payload?.chatId || payload.chatId !== chatId) return;
      if (!payload.userId || payload.userId === member?._id) return;
      clearRemoteTyping();
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("newMessage", onRoomEvent);
    socket.on("chatClaimed", onRoomEvent);
    socket.on("chatClosed", onRoomEvent);
    socket.on("messagesRead", onRoomEvent);
    socket.on("userTyping", onUserTyping);
    socket.on("userStopTyping", onUserStopTyping);

    return () => {
      if (localTypingTimeoutRef.current) {
        window.clearTimeout(localTypingTimeoutRef.current);
        localTypingTimeoutRef.current = null;
      }
      if (queuedEventRefetchTimeoutRef.current !== null) {
        window.clearTimeout(queuedEventRefetchTimeoutRef.current);
        queuedEventRefetchTimeoutRef.current = null;
      }
      if (localTypingSentRef.current) {
        socket.emit("stopTyping", { chatId });
        localTypingSentRef.current = false;
      }
      clearRemoteTyping();
      socket.emit("leaveChat", { chatId });
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("newMessage", onRoomEvent);
      socket.off("chatClaimed", onRoomEvent);
      socket.off("chatClosed", onRoomEvent);
      socket.off("messagesRead", onRoomEvent);
      socket.off("userTyping", onUserTyping);
      socket.off("userStopTyping", onUserStopTyping);
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [chatId, isPageVisible, member?._id, refetch, toast]);

  /** HANDLERS **/

  const stopTypingSignal = () => {
    if (!chat || !localTypingSentRef.current) return;
    const socket = socketRef.current;
    if (!socket) {
      localTypingSentRef.current = false;
      return;
    }
    socket.emit("stopTyping", { chatId: chat._id });
    localTypingSentRef.current = false;
  };

  const scheduleStopTyping = () => {
    if (localTypingTimeoutRef.current) window.clearTimeout(localTypingTimeoutRef.current);
    localTypingTimeoutRef.current = window.setTimeout(() => {
      stopTypingSignal();
      localTypingTimeoutRef.current = null;
    }, 1200);
  };

  const emitTypingSignal = () => {
    if (!chat || !socketConnected) return;
    const socket = socketRef.current;
    if (!socket) return;
    if (!localTypingSentRef.current) {
      socket.emit("typing", { chatId: chat._id });
      localTypingSentRef.current = true;
    }
    scheduleStopTyping();
  };

  const onInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessageInput(value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
    if (!value.trim()) {
      stopTypingSignal();
      return;
    }
    emitTypingSignal();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.closest("form")?.requestSubmit();
    }
  };

  const onSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!chat) return;
    const content = messageInput.trim();
    if (!content) return;
    try {
      await sendMessage({
        variables: { input: { chatId: chat._id, messageType: "TEXT", content } },
      });
      stopTypingSignal();
      setMessageInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch (mutationError) {
      await errorAlert("Could not send message", getErrorMessage(mutationError));
    }
  };

  const onClaimChat = async () => {
    if (!chat) return;
    const confirmed = await confirmAction({
      title: "Claim this chat?",
      text: "You will be assigned as the active agent.",
      confirmText: "Claim",
    });
    if (!confirmed) return;
    try {
      await claimChat({ variables: { input: { chatId: chat._id } } });
      await refetch();
      await successAlert("Chat claimed");
    } catch (mutationError) {
      await errorAlert("Could not claim chat", getErrorMessage(mutationError));
    }
  };

  const onCloseChat = async () => {
    if (!chat) return;
    const confirmed = await confirmDanger({
      title: "Close this chat?",
      text: "This conversation will be marked as closed.",
      warningText: "Closed chats cannot receive new messages.",
      confirmText: "Close chat",
    });
    if (!confirmed) return;
    try {
      await closeChat({ variables: { chatId: chat._id } });
      await refetch();
      await successAlert("Chat closed");
    } catch (mutationError) {
      await errorAlert("Could not close chat", getErrorMessage(mutationError));
    }
  };

  /** COMPUTED **/

  const canClaim = Boolean(
    chat && isAgent && !chat.assignedAgentId && chat.chatStatus !== "CLOSED",
  );
  const canSend = Boolean(chat && chat.chatStatus !== "CLOSED");
  const canClose = Boolean(chat && chat.chatStatus !== "CLOSED" && isOperatorSide);

  const hotelTitle = hotelData?.getHotel.hotelTitle ?? "Hotel Support";
  const hotelLocation = hotelData?.getHotel.hotelLocation ?? "";
  const hotelAvatarColor = avatarBg(chat?.hotelId ?? hotelTitle);

  const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
    WAITING: { label: "Waiting for agent", color: "text-amber-600", dot: "bg-amber-400" },
    ACTIVE: { label: "Active", color: "text-emerald-600", dot: "bg-emerald-400" },
    CLOSED: { label: "Closed", color: "text-slate-400", dot: "bg-slate-300" },
  };

  if (!chatId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-slate-500">Missing chat ID.</p>
        <Link href="/chats" className="mt-3 text-sm text-sky-500 underline">
          Back to chats
        </Link>
      </div>
    );
  }

  const statusCfg = chat ? (STATUS_CONFIG[chat.chatStatus] ?? STATUS_CONFIG.CLOSED) : null;

  return (
    <>
      <style>{`
        @keyframes msgSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes typingFade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes headerFade {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <main
        className="-mx-3 -my-8 flex flex-col overflow-hidden sm:-mx-6 sm:-my-10"
        style={{ height: "calc(100svh - 57px)" }}
      >
        {/* ── Header ── */}
        <header
          className="flex flex-none items-center gap-3 border-b border-slate-100 bg-white px-4 py-3.5 shadow-sm"
          style={{ animation: "headerFade 0.25s ease-out both" }}
        >
          {/* Back */}
          <Link
            href="/chats"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
          >
            <ArrowLeft size={18} />
          </Link>

          {/* Avatar */}
          <div
            className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${hotelAvatarColor} text-sm font-bold uppercase text-white`}
          >
            {hotelTitle.charAt(0)}
            {chat && statusCfg && (
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${statusCfg.dot}`}
              />
            )}
          </div>

          {/* Name + status */}
          <div className="min-w-0 flex-1">
            {chat ? (
              <>
                <p className="truncate text-[15px] font-semibold text-slate-900">
                  {hotelTitle}
                </p>
                <div className="flex items-center gap-1.5">
                  <p className={`text-xs ${statusCfg?.color ?? "text-slate-400"}`}>
                    {statusCfg?.label ?? chat.chatStatus}
                    {hotelLocation ? ` · ${hotelLocation}` : ""}
                  </p>
                  <span title={socketConnected ? "Live connection" : "Polling fallback"}>
                    {socketConnected ? (
                      <Wifi size={10} className="text-emerald-400" />
                    ) : (
                      <WifiOff size={10} className="text-slate-300" />
                    )}
                  </span>
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <div className="h-3.5 w-32 animate-pulse rounded-full bg-slate-100" />
                <div className="h-3 w-20 animate-pulse rounded-full bg-slate-100" />
              </div>
            )}
          </div>

          {/* Agent actions */}
          <div className="flex flex-shrink-0 items-center gap-2">
            {canClaim && (
              <button
                type="button"
                onClick={() => {
                  void onClaimChat();
                }}
                disabled={claiming}
                className="rounded-full bg-sky-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-600 disabled:opacity-60 active:scale-95"
              >
                {claiming ? "Claiming…" : "Claim"}
              </button>
            )}
            {canClose && (
              <button
                type="button"
                onClick={() => {
                  void onCloseChat();
                }}
                disabled={closing}
                className="rounded-full border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-60 active:scale-95"
              >
                {closing ? "Closing…" : "Close"}
              </button>
            )}
          </div>
        </header>

        {/* ── Error banner ── */}
        {error && (
          <div className="flex-none border-b border-rose-100 bg-rose-50 px-5 py-2 text-xs font-medium text-rose-700">
            Failed to load: {getErrorMessage(error)}
          </div>
        )}

        {/* ── Messages area ── */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {/* Loading skeletons */}
          {loading && !chat && (
            <div className="flex flex-col gap-4 px-5 py-8">
              {[false, true, false, true, false].map((own, i) => (
                <div key={i} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`h-10 animate-pulse rounded-2xl ${
                      own ? "w-44 bg-sky-200/50" : "w-56 bg-white shadow-sm"
                    }`}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {chat && chat.messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center py-24 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-100 bg-white shadow-sm">
                <MessageSquare size={22} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Start the conversation</p>
              <p className="mt-1 text-xs text-slate-400">
                Your message goes directly to the hotel team
              </p>
            </div>
          )}

          {/* Messages */}
          {chat && chat.messages.length > 0 && (
            <div className="space-y-0.5 px-4 py-5">
              {chat.messages.map((message, index) => {
                const isOwn =
                  (message.senderType === "GUEST" && isUser) ||
                  (message.senderType === "AGENT" && isOperatorSide);

                const prevMessage = index > 0 ? chat.messages[index - 1] : null;
                const nextMessage =
                  index < chat.messages.length - 1 ? chat.messages[index + 1] : null;

                const showDateSep =
                  !prevMessage || !isSameDay(prevMessage.timestamp, message.timestamp);
                const isLastInGroup =
                  !nextMessage || nextMessage.senderType !== message.senderType;
                const isFirstInGroup =
                  !prevMessage || prevMessage.senderType !== message.senderType;
                const showTime = isLastInGroup || message.messageType !== "TEXT";

                // New messages (arrived after initial load) animate in
                const isNewMsg = index >= prevMessageCountRef.current;

                return (
                  <div key={`${message.senderId}-${message.timestamp}-${index}`}>
                    {/* Date separator */}
                    {showDateSep && (
                      <div className="my-6 flex items-center gap-3">
                        <div className="h-px flex-1 bg-slate-200/70" />
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-0.5 text-[10px] font-semibold tracking-wide text-slate-400 shadow-sm">
                          {formatDateSeparator(message.timestamp)}
                        </span>
                        <div className="h-px flex-1 bg-slate-200/70" />
                      </div>
                    )}

                    {/* Message row */}
                    <div
                      className={`flex ${isOwn ? "justify-end" : "justify-start"} ${
                        isLastInGroup ? "mb-3" : "mb-0.5"
                      }`}
                      style={
                        isNewMsg
                          ? { animation: "msgSlideIn 0.2s ease-out both" }
                          : undefined
                      }
                    >
                      {/* Received: hotel avatar placeholder */}
                      {!isOwn && (
                        <div className="mr-2 mt-auto flex-shrink-0">
                          {isLastInGroup ? (
                            <div
                              className={`flex h-7 w-7 items-center justify-center rounded-full ${hotelAvatarColor} text-[9px] font-bold uppercase text-white`}
                            >
                              {hotelTitle.charAt(0)}
                            </div>
                          ) : (
                            <div className="h-7 w-7" />
                          )}
                        </div>
                      )}

                      <div className="flex max-w-[78%] flex-col gap-0.5 sm:max-w-[68%]">
                        {/* Sender label */}
                        {!isOwn && isFirstInGroup && (
                          <p className="ml-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                            Hotel Staff
                          </p>
                        )}
                        <MessageBubble
                          message={message}
                          isOwn={isOwn}
                          showTime={showTime}
                          isLastInGroup={isLastInGroup}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {typingUserId && (
                <div style={{ animation: "typingFade 0.2s ease-out both" }}>
                  <TypingIndicator />
                </div>
              )}

              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── Input area ── */}
        <div className="flex-none border-t border-slate-100 bg-white px-4 py-3.5 shadow-[0_-1px_8px_rgba(0,0,0,0.04)]">
          {!canSend ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50 py-3">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              <p className="text-sm text-slate-500">This conversation is closed</p>
            </div>
          ) : (
            <form onSubmit={(e) => { void onSendMessage(e); }}>
              <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm transition focus-within:border-slate-300 focus-within:shadow-md">
                <textarea
                  ref={textareaRef}
                  value={messageInput}
                  onChange={onInputChange}
                  onKeyDown={onKeyDown}
                  onBlur={() => {
                    stopTypingSignal();
                  }}
                  rows={1}
                  placeholder="Write a message…"
                  disabled={sending}
                  className="flex-1 resize-none bg-transparent py-1 text-sm text-slate-900 placeholder-slate-400 outline-none"
                  style={{ minHeight: "32px", maxHeight: "160px" }}
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() || sending}
                  className={`mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-all ${
                    messageInput.trim()
                      ? "bg-sky-500 text-white shadow-sm hover:bg-sky-600 active:scale-95"
                      : "text-slate-300"
                  }`}
                  aria-label="Send message"
                >
                  <Send size={15} />
                </button>
              </div>
              {messageInput.trim() && (
                <p className="mt-1.5 text-right text-[10px] text-slate-400">⌘↩ to send</p>
              )}
            </form>
          )}
        </div>
      </main>
    </>
  );
};

ChatThreadPage.auth = {
  roles: ["USER", "AGENT", "ADMIN", "ADMIN_OPERATOR"],
};

export default ChatThreadPage;
