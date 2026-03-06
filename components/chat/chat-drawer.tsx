import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Socket } from "socket.io-client";
import {
  GET_CHAT_QUERY,
  GET_MY_CHATS_QUERY,
  GET_MY_UNREAD_CHAT_COUNT_QUERY,
  MARK_CHAT_MESSAGES_AS_READ_MUTATION,
  SEND_MESSAGE_MUTATION,
} from "@/graphql/chat.gql";
import { GET_HOTELS_QUERY } from "@/graphql/hotel.gql";
import { getAccessToken, getSessionMember } from "@/lib/auth/session";
import { createChatSocket } from "@/lib/socket/chat";
import {
  SUPPORT_CHAT_TITLE,
  avatarBg,
  fmtTime,
  getLastPreview,
  timeAgo,
} from "@/lib/chat/chat-helpers";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  ChatDto,
  GetChatQueryData,
  GetChatQueryVars,
  GetMyChatsQueryData,
  GetMyChatsQueryVars,
  MarkChatMessagesAsReadMutationData,
  MarkChatMessagesAsReadMutationVars,
  MessageDto,
  PaginationInput,
  SendMessageMutationData,
  SendMessageMutationVars,
} from "@/types/chat";
import type {
  GetHotelsQueryData,
  GetHotelsQueryVars,
  HotelListItem,
} from "@/types/hotel";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ExternalLink,
  Headset,
  MessageSquare,
  Send,
  SquarePen,
  X,
} from "lucide-react";

// ─── Compact message bubble ───────────────────────────────────────────────────

function Bubble({
  message,
  isOwn,
  isLast,
}: {
  message: MessageDto;
  isOwn: boolean;
  isLast: boolean;
}) {
  const sent = "bg-[#d4e5f7] text-slate-900 rounded-xl";
  const recv =
    "bg-white text-slate-900 border border-slate-200 shadow-sm rounded-xl";

  return (
    <div
      className={`flex items-end gap-1 ${isOwn ? "justify-end" : "justify-start"} ${isLast ? "mb-2.5" : "mb-0.5"}`}
    >
      {/* Sent: time to the LEFT of bubble */}
      {isOwn && isLast && (
        <div className="flex flex-shrink-0 flex-col items-end gap-0.5 pb-0.5">
          <span className="text-[9px] leading-none text-slate-400">
            {fmtTime(message.timestamp)}
          </span>
          {message.read ? (
            <CheckCheck size={9} className="text-blue-400" />
          ) : (
            <Check size={9} className="text-slate-300" />
          )}
        </div>
      )}

      <div className={`max-w-[80%] overflow-hidden ${isOwn ? sent : recv}`}>
        {message.messageType === "IMAGE" && message.imageUrl && (
          <a
            href={message.imageUrl}
            target="_blank"
            rel="noreferrer"
            className="block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.imageUrl}
              alt="Photo"
              loading="lazy"
              className="block max-h-48 w-full object-cover"
            />
          </a>
        )}
        {message.messageType === "FILE" && message.fileUrl && (
          <a
            href={message.fileUrl}
            download
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-600 transition hover:bg-black/5"
          >
            📎 {message.fileUrl.split("/").pop() ?? "Download"}
          </a>
        )}
        {message.messageType === "TEXT" && (
          <p className="break-words px-3 py-2.5 text-sm leading-relaxed">
            {message.content}
          </p>
        )}
      </div>

      {/* Received: time to the RIGHT of bubble */}
      {!isOwn && isLast && (
        <span className="flex-shrink-0 pb-0.5 text-[9px] leading-none text-slate-400">
          {fmtTime(message.timestamp)}
        </span>
      )}
    </div>
  );
}

// ─── Main ChatDrawer ──────────────────────────────────────────────────────────

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  unreadCount: number;
}

export function ChatDrawer({
  isOpen,
  onClose,
  unreadCount: _unreadCount,
}: ChatDrawerProps) {
  const member = useMemo(() => getSessionMember(), []);
  const isUser = member?.memberType === "USER";
  void _unreadCount;

  const [view, setView] = useState<"list" | "thread">("list");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatHotelName, setActiveChatHotelName] =
    useState<string>("Hotel Support");

  // Mount/unmount with exit animation support
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setView("list");
        setActiveChatId(null);
      }, 280);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop — above header (z-30), below drawer (z-40) */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-[35] bg-black/25 transition-opacity duration-280 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer panel — slides in from right */}
      <div
        className={`fixed inset-0 z-40 flex flex-col bg-white sm:inset-auto sm:bottom-0 sm:right-0 sm:top-[57px] sm:w-[380px] sm:border-l sm:border-slate-200 sm:shadow-2xl transition-transform duration-280 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {view === "list" ? (
          <ListView
            isUser={isUser}
            isOpen={isOpen}
            onClose={onClose}
            onSelectChat={(id, hotelName) => {
              setActiveChatId(id);
              setActiveChatHotelName(hotelName);
              setView("thread");
            }}
          />
        ) : (
          <ThreadView
            chatId={activeChatId ?? ""}
            hotelName={activeChatHotelName}
            isUser={isUser}
            isOpen={isOpen}
            onBack={() => setView("list")}
            onClose={onClose}
          />
        )}
      </div>
    </>
  );
}

// ─── List view ────────────────────────────────────────────────────────────────

function ListView({
  isUser,
  isOpen,
  onClose,
  onSelectChat,
}: {
  isUser: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSelectChat: (chatId: string, hotelName: string) => void;
}) {
  const listInput = useMemo<PaginationInput>(
    () => ({ page: 1, limit: 15, sort: "lastMessageAt", direction: -1 }),
    [],
  );
  const hotelsInput = useMemo(
    () => ({ page: 1, limit: 20, sort: "createdAt", direction: -1 as const }),
    [],
  );

  const { data: chatsData, loading: chatsLoading } = useQuery<
    GetMyChatsQueryData,
    GetMyChatsQueryVars
  >(GET_MY_CHATS_QUERY, {
    skip: !isUser || !isOpen,
    variables: { input: listInput },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
    pollInterval: 30000,
  });

  const { data: agentUnreadData } = useQuery<{ getMyUnreadChatCount: number }>(
    GET_MY_UNREAD_CHAT_COUNT_QUERY,
    {
      skip: isUser || !isOpen,
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
      pollInterval: 30000,
    },
  );
  const agentUnreadCount = agentUnreadData?.getMyUnreadChatCount ?? 0;

  const { data: hotelsData } = useQuery<GetHotelsQueryData, GetHotelsQueryVars>(
    GET_HOTELS_QUERY,
    {
      skip: !isOpen,
      variables: { input: hotelsInput },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  const hotelsMap = useMemo<Map<string, HotelListItem>>(() => {
    const map = new Map<string, HotelListItem>();
    for (const h of hotelsData?.getHotels.list ?? []) map.set(h._id, h);
    return map;
  }, [hotelsData]);

  const chats = chatsData?.getMyChats.list ?? [];

  const STATUS_DOT: Record<string, string> = {
    ACTIVE: "bg-emerald-400",
    WAITING: "bg-amber-400",
    CLOSED: "bg-slate-300",
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-none items-center justify-between border-b border-slate-100 px-4 py-3.5">
        <p className="text-base font-bold text-slate-900">Messages</p>
        <div className="flex items-center gap-1">
          <Link
            href="/chats"
            onClick={onClose}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-sky-500 transition hover:bg-sky-50"
          >
            View all
            <ExternalLink size={11} />
          </Link>
          {isUser && (
            <Link
              href="/chats?openNew=1"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
              title="New conversation"
              aria-label="New conversation"
            >
              <SquarePen size={15} />
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Non-user: staff mini-stats + link */}
        {!isUser && (
          <div className="flex flex-col gap-2 px-4 py-5">
            <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <MessageSquare
                size={15}
                className="flex-shrink-0 text-slate-400"
              />
              <p className="flex-1 text-sm text-slate-600">
                {agentUnreadCount > 0 ? (
                  <>
                    <span className="font-bold text-slate-900">
                      {agentUnreadCount}
                    </span>{" "}
                    unread conversation
                    {agentUnreadCount !== 1 ? "s" : ""}
                  </>
                ) : (
                  "No unread conversations"
                )}
              </p>
              {agentUnreadCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-500 px-1.5 text-[10px] font-bold text-white">
                  {agentUnreadCount > 99 ? "99+" : agentUnreadCount}
                </span>
              )}
            </div>
            <Link
              href="/chats"
              onClick={onClose}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              <ExternalLink size={13} />
              Open chat management
            </Link>
          </div>
        )}

        {/* User: loading skeletons */}
        {isUser && chatsLoading && chats.length === 0 && (
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <div className="h-11 w-11 flex-shrink-0 animate-pulse rounded-full bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-100" />
                  <div className="h-3 w-3/4 animate-pulse rounded-full bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* User: empty state */}
        {isUser && !chatsLoading && chats.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <MessageSquare size={28} className="mb-3 text-slate-200" />
            <p className="font-semibold text-slate-700">No conversations yet</p>
            <p className="mt-1.5 text-sm text-slate-400">
              Message a hotel directly or reach our support team
            </p>
            <div className="mt-5 flex w-full flex-col gap-2">
              <Link
                href="/chats?openNew=1"
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                <SquarePen size={13} />
                New message
              </Link>
              <Link
                href="/chats?openNew=1&openSupport=1"
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Headset size={13} />
                Contact support
              </Link>
            </div>
          </div>
        )}

        {/* User: chat list */}
        {isUser && chats.length > 0 && (
          <div className="divide-y divide-slate-50">
            {chats.map((chat) => {
              const isSupportChat = chat.chatScope === "SUPPORT";
              const hotel =
                !isSupportChat && chat.hotelId
                  ? hotelsMap.get(chat.hotelId)
                  : undefined;
              const hotelName = isSupportChat
                ? SUPPORT_CHAT_TITLE
                : (hotel?.hotelTitle ?? "Hotel Support");
              const unread = chat.unreadGuestMessages;
              const preview = getLastPreview(chat);
              const time = timeAgo(chat.lastMessageAt);
              const color = avatarBg(chat.hotelId ?? chat._id);

              return (
                <button
                  key={chat._id}
                  type="button"
                  onClick={() => onSelectChat(chat._id, hotelName)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 active:bg-slate-100"
                >
                  {/* Avatar with status dot */}
                  <div className="relative flex-shrink-0">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold uppercase text-white ${
                        isSupportChat ? "bg-teal-500" : color
                      }`}
                    >
                      {isSupportChat ? (
                        <Headset size={18} />
                      ) : (
                        hotelName.charAt(0)
                      )}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                        STATUS_DOT[chat.chatStatus] ?? "bg-slate-300"
                      }`}
                    />
                  </div>

                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-1">
                      <p
                        className={`truncate text-sm ${
                          unread > 0
                            ? "font-bold text-slate-900"
                            : "font-semibold text-slate-800"
                        }`}
                      >
                        {hotelName}
                      </p>
                      <span
                        className={`flex-shrink-0 text-[10px] ${
                          unread > 0
                            ? "font-semibold text-sky-500"
                            : "text-slate-400"
                        }`}
                      >
                        {time}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-1">
                      <p
                        className={`truncate text-xs ${
                          unread > 0
                            ? "font-medium text-slate-700"
                            : "text-slate-400"
                        }`}
                      >
                        {preview}
                      </p>
                      {unread > 0 && (
                        <span className="flex min-w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-sky-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* ── Sticky Contact Support entry ── */}
            <Link
              href="/chats?openNew=1&openSupport=1"
              onClick={onClose}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 active:bg-slate-100"
            >
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-teal-500 text-white">
                <Headset size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  Contact Support
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  Meomul platform support
                </p>
              </div>
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Thread view ──────────────────────────────────────────────────────────────

function ThreadView({
  chatId,
  hotelName,
  isUser,
  isOpen,
  onBack,
  onClose,
}: {
  chatId: string;
  hotelName: string;
  isUser: boolean;
  isOpen: boolean;
  onBack: () => void;
  onClose: () => void;
}) {
  const [messageInput, setMessageInput] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const lastMarkedRef = useRef("");

  const { data, loading, error, refetch, startPolling, stopPolling } = useQuery<
    GetChatQueryData,
    GetChatQueryVars
  >(GET_CHAT_QUERY, {
    skip: !chatId || !isOpen,
    variables: { chatId },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const [sendMessage, { loading: sending }] = useMutation<
    SendMessageMutationData,
    SendMessageMutationVars
  >(SEND_MESSAGE_MUTATION);

  const [markRead] = useMutation<
    MarkChatMessagesAsReadMutationData,
    MarkChatMessagesAsReadMutationVars
  >(MARK_CHAT_MESSAGES_AS_READ_MUTATION);

  const chat = data?.getChat;
  const unreadForMe = chat
    ? isUser
      ? chat.unreadGuestMessages
      : chat.unreadAgentMessages
    : 0;

  // Auto mark-as-read
  useEffect(() => {
    if (!chat || unreadForMe === 0) return;
    const key = `${chat._id}:${(chat.messages ?? []).length}:${unreadForMe}`;
    if (lastMarkedRef.current === key) return;
    lastMarkedRef.current = key;
    void markRead({ variables: { chatId: chat._id } }).catch(() => undefined);
  }, [chat, markRead, unreadForMe]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages?.length]);

  // Fallback polling when socket is disconnected
  useEffect(() => {
    if (!chatId || !isOpen || socketConnected) {
      stopPolling();
      return;
    }
    startPolling(30000);
    return () => {
      stopPolling();
    };
  }, [chatId, isOpen, socketConnected, startPolling, stopPolling]);

  // Socket — connect only when open
  useEffect(() => {
    if (!chatId || !isOpen) return;
    const token = getAccessToken();
    if (!token) return;

    const socket = createChatSocket(token);
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit("authenticate", { token }, () => {
        socket.emit("joinChat", { chatId });
      });
    });
    socket.on("disconnect", () => setSocketConnected(false));

    socket.on("newMessage", (payload: { chatId: string }) => {
      if (payload?.chatId === chatId) void refetch();
    });
    socket.on("messagesRead", (payload: { chatId: string }) => {
      if (payload?.chatId === chatId) void refetch();
    });

    return () => {
      socket.emit("leaveChat", { chatId });
      socket.off("newMessage");
      socket.off("messagesRead");
      socket.off("connect");
      socket.off("disconnect");
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [chatId, isOpen, refetch]);

  const onSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!chat) return;
    const content = messageInput.trim();
    if (!content || sending) return;
    try {
      await sendMessage({
        variables: {
          input: { chatId: chat._id, messageType: "TEXT", content },
        },
      });
      setMessageInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch {
      // silent — user can retry
    }
  };

  const hotelColor = avatarBg(chatId);
  const canSend = Boolean(chat && chat.chatStatus !== "CLOSED");

  return (
    <>
      {/* Header */}
      <div className="flex flex-none items-center gap-2.5 border-b border-slate-100 px-3 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sky-500 transition hover:bg-sky-50"
          aria-label="Back to list"
        >
          <ArrowLeft size={18} />
        </button>

        <div
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase text-white ${
            hotelName === SUPPORT_CHAT_TITLE ? "bg-teal-500" : hotelColor
          }`}
        >
          {hotelName === SUPPORT_CHAT_TITLE ? (
            <Headset size={14} />
          ) : (
            hotelName.charAt(0)
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">
            {chat?.chatStatus === "CLOSED" ? "Closed chat" : hotelName}
          </p>
          {chat && (
            <p className="text-[10px] text-slate-400">
              {chat.chatStatus === "ACTIVE"
                ? "Active"
                : chat.chatStatus === "WAITING"
                  ? "Waiting for agent"
                  : "Closed"}
            </p>
          )}
        </div>

        <Link
          href={`/chats/${chatId}`}
          onClick={onClose}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100"
          title="Open full chat"
        >
          <ExternalLink size={15} />
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-slate-50 px-3 py-3">
        {loading && !chat && (
          <div className="flex flex-col gap-3">
            {[false, true, false, true].map((own, i) => (
              <div
                key={i}
                className={`flex ${own ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`h-8 animate-pulse rounded-2xl ${
                    own ? "w-32 bg-blue-100/60" : "w-44 bg-white"
                  }`}
                />
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="text-center text-xs text-rose-500">
            Could not load chat: {getErrorMessage(error)}
          </p>
        )}

        {chat && (chat.messages ?? []).length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="mb-2 text-3xl">💬</span>
            <p className="text-xs text-slate-400">No messages yet</p>
          </div>
        )}

        {chat && (chat.messages ?? []).length > 0 && (
          <>
            {(chat.messages ?? []).map((message, index) => {
              const isOwn =
                (message.senderType === "GUEST" && isUser) ||
                (message.senderType === "AGENT" && !isUser);
              const nextMessage =
                index < (chat.messages ?? []).length - 1
                  ? (chat.messages ?? [])[index + 1]
                  : null;
              const isLastInGroup =
                !nextMessage || nextMessage.senderType !== message.senderType;

              return (
                <Bubble
                  key={`${message.senderId}-${message.timestamp}-${index}`}
                  message={message}
                  isOwn={isOwn}
                  isLast={isLastInGroup}
                />
              );
            })}
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-none border-t border-slate-200 bg-white px-3 py-2.5">
        {!canSend ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-center text-xs text-slate-500">
            Conversation closed ·{" "}
            <Link
              href={`/chats/${chatId}`}
              onClick={onClose}
              className="text-sky-500"
            >
              View full chat
            </Link>
          </div>
        ) : (
          <form onSubmit={onSend}>
            <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
              <textarea
                ref={textareaRef}
                value={messageInput}
                onChange={(e) => {
                  setMessageInput(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.closest("form")?.requestSubmit();
                  }
                }}
                placeholder="Write a message…"
                rows={1}
                disabled={sending}
                className="flex-1 resize-none bg-transparent py-1 text-sm text-slate-900 placeholder-slate-400 outline-none"
                style={{ minHeight: "32px", maxHeight: "120px" }}
              />
              <button
                type="submit"
                disabled={!messageInput.trim() || sending}
                className={`mb-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-all ${
                  messageInput.trim()
                    ? "bg-sky-500 text-white hover:bg-sky-600 active:scale-95"
                    : "text-slate-300"
                }`}
                aria-label="Send message"
              >
                <Send size={13} />
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
