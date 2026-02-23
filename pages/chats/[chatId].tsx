import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useToast } from "@/components/ui/toast-provider";
import {
  CLAIM_CHAT_MUTATION,
  CLOSE_CHAT_MUTATION,
  GET_CHAT_QUERY,
  MARK_CHAT_MESSAGES_AS_READ_MUTATION,
  SEND_MESSAGE_MUTATION,
} from "@/graphql/chat.gql";
import { getSessionMember } from "@/lib/auth/session";
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

const formatDateTime = (value: string): string => new Date(value).toLocaleString();

const renderMessageBody = (message: MessageDto): string => {
  if (message.messageType === "IMAGE") {
    return message.imageUrl?.trim() || "Image";
  }
  if (message.messageType === "FILE") {
    return message.fileUrl?.trim() || "File";
  }
  return message.content?.trim() || "";
};

const ChatThreadPage: NextPageWithAuth = () => {
  const router = useRouter();
  const toast = useToast();
  const member = useMemo(() => getSessionMember(), []);
  const memberType = member?.memberType;
  const isUser = memberType === "USER";
  const isAgent = memberType === "AGENT";
  const isOperatorSide = !isUser;
  const chatId = typeof router.query.chatId === "string" ? router.query.chatId : "";

  const [messageInput, setMessageInput] = useState("");
  const lastMarkedKeyRef = useRef("");

  const { data, loading, error, refetch } = useQuery<GetChatQueryData, GetChatQueryVars>(GET_CHAT_QUERY, {
    skip: !chatId,
    variables: { chatId },
    fetchPolicy: "cache-and-network",
    pollInterval: 5000,
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
      toast.error(getErrorMessage(mutationError));
    });
  }, [chat, markRead, toast, unreadForMe]);

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
      toast.error("Message cannot be empty.");
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
      setMessageInput("");
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
    }
  };

  const onClaimChat = async () => {
    if (!chat) {
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
      toast.success("Chat claimed.");
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
    }
  };

  const onCloseChat = async () => {
    if (!chat) {
      return;
    }

    try {
      await closeChat({
        variables: {
          chatId: chat._id,
        },
      });
      await refetch();
      toast.success("Chat closed.");
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
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

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {getErrorMessage(error)}
        </section>
      ) : null}

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
                <p className="text-sm text-slate-600">Last message: {formatDateTime(chat.lastMessageAt)}</p>
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
                        <p className="mt-1 text-[11px] opacity-70">{formatDateTime(message.timestamp)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">Send Message</h2>
            {!canSend ? <p className="mt-2 text-sm text-slate-600">Chat is closed. You cannot send messages.</p> : null}
            <form onSubmit={onSendMessage} className="mt-3 space-y-3">
              <textarea
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
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
