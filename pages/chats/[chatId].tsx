import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Socket } from "socket.io-client";
import { ErrorNotice } from "@/components/ui/error-notice";
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
import { confirmAction, confirmDanger, errorAlert, infoAlert, successAlert } from "@/lib/ui/alerts";
import { getErrorMessage } from "@/lib/utils/error";
import { formatDateTimeKst } from "@/lib/utils/format";
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

const renderMessageBody = (message: MessageDto): string => {
  if (message.messageType === "IMAGE") {
    return message.imageUrl?.trim() || "Image";
  }
  if (message.messageType === "FILE") {
    return message.fileUrl?.trim() || "File";
  }
  return message.content?.trim() || "";
};

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

const logBackgroundChatError = (context: string, error: unknown): void => {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[Chat background] ${context}: ${getErrorMessage(error)}`);
  }
};

const ChatThreadPage: NextPageWithAuth = () => {
  const router = useRouter();
  const toast = useToast();
  const member = useMemo(() => getSessionMember(), []);
  const isPageVisible = usePageVisible();
  const memberType = member?.memberType;
  const isUser = memberType === "USER";
  const isAgent = memberType === "AGENT";
  const isOperatorSide = !isUser;
  const chatId = typeof router.query.chatId === "string" ? router.query.chatId : "";

  const [messageInput, setMessageInput] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const lastMarkedKeyRef = useRef("");
  const socketRef = useRef<Socket | null>(null);
  const remoteTypingTimeoutRef = useRef<number | null>(null);
  const localTypingTimeoutRef = useRef<number | null>(null);
  const localTypingSentRef = useRef(false);
  const socketJoinFailedRef = useRef(false);
  const lastEventRefetchAtRef = useRef(0);
  const queuedEventRefetchTimeoutRef = useRef<number | null>(null);

  const { data, loading, error, refetch, startPolling, stopPolling } = useQuery<GetChatQueryData, GetChatQueryVars>(GET_CHAT_QUERY, {
    skip: !chatId,
    variables: { chatId },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const [sendMessage, { loading: sending }] = useMutation<SendMessageMutationData, SendMessageMutationVars>(SEND_MESSAGE_MUTATION);
  const [markRead] = useMutation<MarkChatMessagesAsReadMutationData, MarkChatMessagesAsReadMutationVars>(
    MARK_CHAT_MESSAGES_AS_READ_MUTATION,
  );
  const [claimChat, { loading: claiming }] = useMutation<ClaimChatMutationData, ClaimChatMutationVars>(CLAIM_CHAT_MUTATION);
  const [closeChat, { loading: closing }] = useMutation<CloseChatMutationData, CloseChatMutationVars>(CLOSE_CHAT_MUTATION);

  const chat = data?.getChat;
  const unreadForMe = chat ? (isUser ? chat.unreadGuestMessages : chat.unreadAgentMessages) : 0;

  useEffect(() => {
    if (!chat) {
      return;
    }
    if (unreadForMe === 0) {
      return;
    }

    const markKey = `${chat._id}:${chat.messages.length}:${unreadForMe}`;
    if (lastMarkedKeyRef.current === markKey) {
      return;
    }
    lastMarkedKeyRef.current = markKey;

    void markRead({
      variables: {
        chatId: chat._id,
      },
    }).catch((mutationError: unknown) => {
      logBackgroundChatError("mark-as-read failed", mutationError);
    });
  }, [chat, markRead, unreadForMe]);

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

  useEffect(() => {
    if (!chatId || socketConnected || !isPageVisible) {
      return;
    }

    void refetch();
  }, [chatId, isPageVisible, refetch, socketConnected]);

  useEffect(() => {
    if (!chatId) {
      return;
    }
    if (!isPageVisible) {
      return;
    }

    const token = getAccessToken();
    if (!token) {
      return;
    }

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

      if (queuedEventRefetchTimeoutRef.current !== null) {
        return;
      }

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
            toast.info(authAck?.error ?? "Chat realtime authentication failed. Using refresh fallback.");
            socketJoinFailedRef.current = true;
          }
          return;
        }

        socket.emit("joinChat", { chatId }, (joinAck?: SocketAck) => {
          if (!joinAck?.success && !socketJoinFailedRef.current) {
            toast.info(joinAck?.error ?? "Chat realtime join failed. Using refresh fallback.");
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
      if (!payload?.chatId || payload.chatId !== chatId) {
        return;
      }
      requestRefetch();
    };

    const onUserTyping = (payload: TypingEventPayload) => {
      if (!payload?.chatId || payload.chatId !== chatId) {
        return;
      }
      if (!payload.userId || payload.userId === member?._id) {
        return;
      }

      setTypingUserId(payload.userId);
      if (remoteTypingTimeoutRef.current) {
        window.clearTimeout(remoteTypingTimeoutRef.current);
      }
      remoteTypingTimeoutRef.current = window.setTimeout(() => {
        setTypingUserId(null);
        remoteTypingTimeoutRef.current = null;
      }, 2000);
    };

    const onUserStopTyping = (payload: TypingEventPayload) => {
      if (!payload?.chatId || payload.chatId !== chatId) {
        return;
      }
      if (!payload.userId || payload.userId === member?._id) {
        return;
      }
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

  const stopTypingSignal = () => {
    if (!chat) {
      return;
    }
    if (!localTypingSentRef.current) {
      return;
    }

    const socket = socketRef.current;
    if (!socket) {
      localTypingSentRef.current = false;
      return;
    }

    socket.emit("stopTyping", { chatId: chat._id });
    localTypingSentRef.current = false;
  };

  const scheduleStopTyping = () => {
    if (localTypingTimeoutRef.current) {
      window.clearTimeout(localTypingTimeoutRef.current);
    }
    localTypingTimeoutRef.current = window.setTimeout(() => {
      stopTypingSignal();
      localTypingTimeoutRef.current = null;
    }, 1200);
  };

  const emitTypingSignal = () => {
    if (!chat || !socketConnected) {
      return;
    }
    const socket = socketRef.current;
    if (!socket) {
      return;
    }

    if (!localTypingSentRef.current) {
      socket.emit("typing", { chatId: chat._id });
      localTypingSentRef.current = true;
    }
    scheduleStopTyping();
  };

  const canClaim = Boolean(chat && isAgent && !chat.assignedAgentId && chat.chatStatus !== "CLOSED");
  const canSend = Boolean(chat && chat.chatStatus !== "CLOSED");
  const canClose = Boolean(chat && chat.chatStatus !== "CLOSED");

  const onSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!chat) {
      return;
    }

    const content = messageInput.trim();
    if (!content) {
      await infoAlert("Empty message", "Message cannot be empty.");
      return;
    }

    try {
      await sendMessage({
        variables: {
          input: {
            chatId: chat._id,
            messageType: "TEXT",
            content,
          },
        },
      });
      stopTypingSignal();
      setMessageInput("");
    } catch (mutationError) {
      await errorAlert("Could not send message", getErrorMessage(mutationError));
    }
  };

  const onClaimChat = async () => {
    if (!chat) {
      return;
    }

    const confirmed = await confirmAction({
      title: "Claim this chat?",
      text: "You will be assigned as the active agent for this chat.",
      confirmText: "Claim chat",
    });

    if (!confirmed) {
      return;
    }

    try {
      await claimChat({
        variables: {
          input: {
            chatId: chat._id,
          },
        },
      });
      await refetch();
      await successAlert("Chat claimed");
    } catch (mutationError) {
      await errorAlert("Could not claim chat", getErrorMessage(mutationError));
    }
  };

  const onCloseChat = async () => {
    if (!chat) {
      return;
    }

    const confirmed = await confirmDanger({
      title: "Close this chat?",
      text: "This conversation will be moved to closed status.",
      warningText: "Closed chats cannot accept new messages.",
      confirmText: "Close chat",
    });

    if (!confirmed) {
      return;
    }

    try {
      await closeChat({
        variables: {
          chatId: chat._id,
        },
      });
      await refetch();
      await successAlert("Chat closed");
    } catch (mutationError) {
      await errorAlert("Could not close chat", getErrorMessage(mutationError));
    }
  };

  if (!chatId) {
    return (
      <main className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
        Missing chat id.
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/chats" className="text-slate-600 underline underline-offset-4">
          Back to chats
        </Link>
      </div>

      {error ? <ErrorNotice message={getErrorMessage(error)} /> : null}

      {loading && !chat ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          Loading chat...
        </section>
      ) : null}

      {chat ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Chat Thread</p>
                <h1 className="mt-2 text-2xl font-semibold text-slate-900">{chat._id}</h1>
                <p className="mt-1 text-sm text-slate-600">Status: {chat.chatStatus}</p>
                <p className="text-sm text-slate-600">Hotel: {chat.hotelId}</p>
                <p className="text-sm text-slate-600">Guest: {chat.guestId}</p>
                <p className="text-sm text-slate-600">Assigned Agent: {chat.assignedAgentId || "Unassigned"}</p>
                <p className="text-sm text-slate-600">Last message: {formatDateTimeKst(chat.lastMessageAt)}</p>
                <p className="text-sm text-slate-600">
                  Realtime:{" "}
                  <span className={socketConnected ? "font-semibold text-emerald-700" : "font-semibold text-slate-600"}>
                    {socketConnected ? "Connected" : "Fallback polling"}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void refetch();
                  }}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
                >
                  Refresh
                </button>
                {canClaim ? (
                  <button
                    type="button"
                    onClick={() => {
                      void onClaimChat();
                    }}
                    disabled={claiming}
                    className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {claiming ? "Claiming..." : "Claim"}
                  </button>
                ) : null}
                {canClose ? (
                  <button
                    type="button"
                    onClick={() => {
                      void onCloseChat();
                    }}
                    disabled={closing}
                    className="rounded-md bg-rose-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {closing ? "Closing..." : "Close"}
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">Messages</h2>
            {chat.messages.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No messages yet.</p>
            ) : (
              <div className="mt-3 flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
                {chat.messages.map((message, index) => {
                  const ownMessage =
                    (message.senderType === "GUEST" && isUser) || (message.senderType === "AGENT" && isOperatorSide);
                  return (
                    <div key={`${message.senderId}-${message.timestamp}-${index}`} className={`flex ${ownMessage ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                          ownMessage ? "bg-slate-900 text-white" : "border border-slate-200 bg-slate-50 text-slate-800"
                        }`}
                      >
                        <p className="text-xs opacity-80">
                          {message.senderType} · {message.messageType}
                        </p>
                        <p className="mt-1 break-words">{renderMessageBody(message)}</p>
                        <p className="mt-1 text-[11px] opacity-70">{formatDateTimeKst(message.timestamp)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {typingUserId ? <p className="mt-2 text-xs text-slate-500">Someone is typing...</p> : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">Send Message</h2>
            {!canSend ? <p className="mt-2 text-sm text-slate-600">Chat is closed. You cannot send messages.</p> : null}
            <form onSubmit={onSendMessage} className="mt-3 space-y-3">
              <textarea
                value={messageInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setMessageInput(nextValue);
                  if (!nextValue.trim()) {
                    stopTypingSignal();
                    return;
                  }
                  emitTypingSignal();
                }}
                onBlur={() => {
                  stopTypingSignal();
                }}
                className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                placeholder="Type your message..."
                disabled={!canSend || sending}
                required
              />
              <button
                type="submit"
                disabled={!canSend || sending}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </form>
          </section>
        </>
      ) : null}
    </main>
  );
};

ChatThreadPage.auth = {
  roles: ["USER", "AGENT", "ADMIN", "ADMIN_OPERATOR"],
};

export default ChatThreadPage;
