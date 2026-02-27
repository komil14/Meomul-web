import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import { StatusPills } from "@/components/ui/status-pills";
import { GET_HOTEL_CHATS_QUERY, GET_MY_CHATS_QUERY, START_CHAT_MUTATION } from "@/graphql/chat.gql";
import { GET_AGENT_HOTELS_QUERY, GET_HOTELS_QUERY } from "@/graphql/hotel.gql";
import { usePaginationQueryState } from "@/lib/hooks/use-pagination-query-state";
import { getSessionMember } from "@/lib/auth/session";
import { errorAlert, infoAlert, successAlert } from "@/lib/ui/alerts";
import { getErrorMessage } from "@/lib/utils/error";
import { formatDateTimeKst, formatNumber } from "@/lib/utils/format";
import type {
  ChatDto,
  ChatStatus,
  GetHotelChatsQueryData,
  GetHotelChatsQueryVars,
  GetMyChatsQueryData,
  GetMyChatsQueryVars,
  PaginationInput,
  StartChatMutationData,
  StartChatMutationVars,
} from "@/types/chat";
import type {
  GetAgentHotelsQueryData,
  GetAgentHotelsQueryVars,
  GetHotelsQueryData,
  GetHotelsQueryVars,
  HotelListItem,
} from "@/types/hotel";
import type { NextPageWithAuth } from "@/types/page";

const PAGE_LIMIT = 15;
const HOTEL_LIST_LIMIT = 200;
const CHAT_STATUSES: ChatStatus[] = ["WAITING", "ACTIVE", "CLOSED"];

const getLastMessagePreview = (chat: ChatDto): string => {
  const message = chat.messages.at(-1);
  if (!message) {
    return "No messages yet.";
  }

  if (message.messageType === "IMAGE") {
    return "Image message";
  }
  if (message.messageType === "FILE") {
    return "File message";
  }

  return message.content?.trim() || "Text message";
};

const ChatsPage: NextPageWithAuth = () => {
  const router = useRouter();
  const member = useMemo(() => getSessionMember(), []);
  const memberType = member?.memberType;
  const isUser = memberType === "USER";
  const isAgent = memberType === "AGENT";
  const isStaff = memberType === "AGENT" || memberType === "ADMIN" || memberType === "ADMIN_OPERATOR";
  const { page, statusFilter, getParam, pushQuery, replaceQuery } = usePaginationQueryState<ChatStatus>({
    pathname: "/chats",
    statusValues: CHAT_STATUSES,
  });
  const hotelIdFromQuery = getParam("hotelId");

  const listInput = useMemo<PaginationInput>(
    () => ({
      page,
      limit: PAGE_LIMIT,
      sort: "lastMessageAt",
      direction: -1,
    }),
    [page],
  );

  const hotelsInput = useMemo(
    () => ({
      page: 1,
      limit: HOTEL_LIST_LIMIT,
      sort: "createdAt",
      direction: -1 as const,
    }),
    [],
  );

  const {
    data: agentHotelsData,
    loading: agentHotelsLoading,
    error: agentHotelsError,
  } = useQuery<GetAgentHotelsQueryData, GetAgentHotelsQueryVars>(GET_AGENT_HOTELS_QUERY, {
    skip: !isAgent,
    variables: { input: hotelsInput },
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const {
    data: publicHotelsData,
    loading: publicHotelsLoading,
    error: publicHotelsError,
  } = useQuery<GetHotelsQueryData, GetHotelsQueryVars>(GET_HOTELS_QUERY, {
    skip: !(isStaff || isUser),
    variables: { input: hotelsInput },
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const availableHotels = useMemo<HotelListItem[]>(() => {
    if (isAgent) {
      return agentHotelsData?.getAgentHotels.list ?? [];
    }

    return publicHotelsData?.getHotels.list ?? [];
  }, [agentHotelsData?.getAgentHotels.list, isAgent, publicHotelsData?.getHotels.list]);

  const [manualStaffHotelId, setManualStaffHotelId] = useState("");
  const [startHotelIdFromList, setStartHotelIdFromList] = useState("");
  const [startManualHotelId, setStartManualHotelId] = useState("");

  useEffect(() => {
    if (!isStaff) {
      return;
    }
    if (!hotelIdFromQuery) {
      return;
    }
    setManualStaffHotelId(hotelIdFromQuery);
  }, [hotelIdFromQuery, isStaff]);

  const selectedHotelId = isStaff ? hotelIdFromQuery || manualStaffHotelId.trim() || availableHotels[0]?._id || "" : "";

  useEffect(() => {
    if (!isStaff || hotelIdFromQuery || availableHotels.length === 0) {
      return;
    }

    replaceQuery({
      extra: { hotelId: availableHotels[0]._id },
    });
  }, [availableHotels, hotelIdFromQuery, isStaff, replaceQuery]);

  useEffect(() => {
    if (!isUser) {
      return;
    }
    if (startHotelIdFromList || startManualHotelId || availableHotels.length === 0) {
      return;
    }
    setStartHotelIdFromList(availableHotels[0]._id);
  }, [availableHotels, isUser, startHotelIdFromList, startManualHotelId]);

  const {
    data: myChatsData,
    loading: myChatsLoading,
    error: myChatsError,
  } = useQuery<GetMyChatsQueryData, GetMyChatsQueryVars>(GET_MY_CHATS_QUERY, {
    skip: !isUser,
    variables: { input: listInput },
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const {
    data: hotelChatsData,
    loading: hotelChatsLoading,
    error: hotelChatsError,
  } = useQuery<GetHotelChatsQueryData, GetHotelChatsQueryVars>(GET_HOTEL_CHATS_QUERY, {
    skip: !isStaff || !selectedHotelId,
    variables: {
      hotelId: selectedHotelId,
      input: listInput,
      statusFilter: statusFilter === "ALL" ? undefined : statusFilter,
    },
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-first",
  });

  const [startChat, { loading: startingChat }] = useMutation<StartChatMutationData, StartChatMutationVars>(START_CHAT_MUTATION);
  const [startBookingId, setStartBookingId] = useState("");
  const [startMessage, setStartMessage] = useState("");

  const chats = isStaff ? (hotelChatsData?.getHotelChats.list ?? []) : (myChatsData?.getMyChats.list ?? []);
  const total = isStaff ? (hotelChatsData?.getHotelChats.metaCounter.total ?? 0) : (myChatsData?.getMyChats.metaCounter.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const loading = isStaff ? hotelChatsLoading : myChatsLoading;
  const error = isStaff ? hotelChatsError : myChatsError;

  const hotelsLoading = isAgent ? agentHotelsLoading : publicHotelsLoading;
  const hotelsError = isAgent ? agentHotelsError : publicHotelsError;

  const pushChatsQuery = (next: { hotelId?: string; status?: ChatStatus | "ALL"; page?: number }) => {
    pushQuery({
      page: next.page,
      status: next.status,
      extra: isStaff ? { hotelId: next.hotelId ?? selectedHotelId } : undefined,
    });
  };

  const unreadForMe = (chat: ChatDto): number => {
    if (isUser) {
      return chat.unreadGuestMessages;
    }
    return chat.unreadAgentMessages;
  };

  const submitStartChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const hotelId = (startHotelIdFromList || startManualHotelId).trim();
    const initialMessage = startMessage.trim();
    if (!hotelId) {
      await infoAlert("Hotel required", "Select a hotel from the list or paste a hotelId.");
      return;
    }
    if (!initialMessage) {
      await infoAlert("Initial message required", "Enter a message to start the chat.");
      return;
    }

    try {
      const response = await startChat({
        variables: {
          input: {
            hotelId,
            initialMessage,
            bookingId: startBookingId.trim() || undefined,
          },
        },
      });

      const newChatId = response.data?.startChat._id;
      if (!newChatId) {
        await errorAlert("Could not open chat", "Chat was created but chat id is missing.");
        return;
      }

      await successAlert("Chat started");
      void router.push(`/chats/${newChatId}`);
    } catch (mutationError) {
      await errorAlert("Could not start chat", getErrorMessage(mutationError));
    }
  };

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Messages</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Chats</h1>
          <p className="mt-2 text-sm text-slate-600">
            {isStaff ? "Hotel support conversations by selected property." : "Your hotel support conversations."}
          </p>
        </div>
      </header>

      {isStaff ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Hotel</span>
              <select
                value={selectedHotelId}
                onChange={(event) => {
                  setManualStaffHotelId(event.target.value);
                  pushChatsQuery({ hotelId: event.target.value, page: 1 });
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                disabled={availableHotels.length === 0}
              >
                {availableHotels.length === 0 ? <option value="">No hotels in list</option> : null}
                {availableHotels.map((hotel) => (
                  <option key={hotel._id} value={hotel._id}>
                    {hotel.hotelTitle} ({hotel.hotelLocation})
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">If list is empty, enter hotelId manually below.</p>
            </label>

            <div>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Manual hotelId</span>
                <div className="flex gap-2">
                  <input
                    value={manualStaffHotelId}
                    onChange={(event) => setManualStaffHotelId(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                    placeholder="Paste hotel _id"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const manualId = manualStaffHotelId.trim();
                      if (!manualId) {
                        void infoAlert("Hotel id required", "Enter hotelId first.");
                        return;
                      }
                      pushChatsQuery({ hotelId: manualId, page: 1 });
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                  >
                    Apply
                  </button>
                </div>
              </label>

              <p className="mb-2 mt-4 block text-sm font-medium text-slate-700">Status</p>
              <StatusPills
                label="Status"
                options={CHAT_STATUSES}
                selected={statusFilter}
                onSelect={(nextStatus) => pushChatsQuery({ status: nextStatus as ChatStatus | "ALL", page: 1 })}
              />
            </div>
          </div>
        </section>
      ) : null}

      {isUser ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Start New Chat</h2>
          <form onSubmit={submitStartChat} className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Hotel (from list)</span>
              <select
                value={startHotelIdFromList}
                onChange={(event) => setStartHotelIdFromList(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
              >
                <option value="">Select hotel</option>
                {availableHotels.map((hotel) => (
                  <option key={hotel._id} value={hotel._id}>
                    {hotel.hotelTitle} ({hotel.hotelLocation})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Manual hotelId (fallback)</span>
              <input
                value={startManualHotelId}
                onChange={(event) => setStartManualHotelId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                placeholder="Paste hotel _id if list empty"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Booking ID (optional)</span>
              <input
                value={startBookingId}
                onChange={(event) => setStartBookingId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                placeholder="Booking _id"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-700">Initial Message</span>
              <textarea
                value={startMessage}
                onChange={(event) => setStartMessage(event.target.value)}
                className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                placeholder="Describe your request..."
                required
              />
            </label>

            <button
              type="submit"
              disabled={startingChat}
              className="w-fit rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {startingChat ? "Starting..." : "Start chat"}
            </button>
          </form>
        </section>
      ) : null}

      {hotelsLoading ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Loading hotel list...</section>
      ) : null}
      {hotelsError ? <ErrorNotice message={`Hotel list error: ${getErrorMessage(hotelsError)}`} /> : null}

      {error ? <ErrorNotice message={getErrorMessage(error)} /> : null}

      {loading && chats.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">Loading chats...</section>
      ) : null}

      {!loading && !error && chats.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">No chats found.</section>
      ) : null}

      {chats.length > 0 ? (
        <section className="grid gap-3">
          {chats.map((chat) => (
            <article key={chat._id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Chat</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">{chat._id}</h2>
                  <p className="mt-1 text-sm text-slate-600">Hotel: {chat.hotelId}</p>
                  <p className="text-sm text-slate-600">Last activity: {formatDateTimeKst(chat.lastMessageAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-700">Status: {chat.chatStatus}</p>
                  <p className="text-sm text-slate-600">Unread: {unreadForMe(chat)}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-700">Last message: {getLastMessagePreview(chat)}</p>
              <div className="mt-3">
                <Link href={`/chats/${chat._id}`} className="text-sm font-semibold text-slate-700 underline underline-offset-4">
                  Open chat
                </Link>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <p className="text-slate-600">
          Page {page} / {totalPages} · Total records: {formatNumber(total)}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => pushChatsQuery({ page: page - 1 })}
            disabled={page <= 1}
            className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => pushChatsQuery({ page: page + 1 })}
            disabled={page >= totalPages}
            className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </footer>
    </main>
  );
};

ChatsPage.auth = {
  roles: ["USER", "AGENT", "ADMIN", "ADMIN_OPERATOR"],
};

export default ChatsPage;
