import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { GET_HOTEL_CHATS_QUERY, GET_MY_CHATS_QUERY, START_CHAT_MUTATION } from "@/graphql/chat.gql";
import { GET_AGENT_HOTELS_QUERY, GET_HOTELS_QUERY } from "@/graphql/hotel.gql";
import { getSessionMember } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/error";
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

const parsePage = (value: string | string[] | undefined): number => {
  if (typeof value !== "string") {
    return 1;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
};

const parseStatus = (value: string | string[] | undefined): ChatStatus | "ALL" => {
  if (typeof value !== "string") {
    return "ALL";
  }

  if (CHAT_STATUSES.includes(value as ChatStatus)) {
    return value as ChatStatus;
  }

  return "ALL";
};

const formatDateTime = (value: string): string => new Date(value).toLocaleString();

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
  const toast = useToast();
  const member = useMemo(() => getSessionMember(), []);
  const memberType = member?.memberType;
  const isUser = memberType === "USER";
  const isAgent = memberType === "AGENT";
  const isStaff = memberType === "AGENT" || memberType === "ADMIN" || memberType === "ADMIN_OPERATOR";

  const page = parsePage(router.query.page);
  const statusFilter = parseStatus(router.query.status);
  const hotelIdFromQuery = typeof router.query.hotelId === "string" ? router.query.hotelId : "";

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

  const { data: agentHotelsData } = useQuery<GetAgentHotelsQueryData, GetAgentHotelsQueryVars>(GET_AGENT_HOTELS_QUERY, {
    skip: !isAgent,
    variables: { input: hotelsInput },
    fetchPolicy: "cache-and-network",
  });

  const { data: publicHotelsData } = useQuery<GetHotelsQueryData, GetHotelsQueryVars>(GET_HOTELS_QUERY, {
    skip: !(isStaff || isUser),
    variables: { input: hotelsInput },
    fetchPolicy: "cache-and-network",
  });

  const availableHotels = useMemo<HotelListItem[]>(() => {
    if (isAgent) {
      return agentHotelsData?.getAgentHotels.list ?? [];
    }

    return publicHotelsData?.getHotels.list ?? [];
  }, [agentHotelsData?.getAgentHotels.list, isAgent, publicHotelsData?.getHotels.list]);

  const selectedHotelId = hotelIdFromQuery || availableHotels[0]?._id || "";

  useEffect(() => {
    if (!router.isReady || !isStaff || hotelIdFromQuery || availableHotels.length === 0) {
      return;
    }

    const query: Record<string, string> = {
      hotelId: availableHotels[0]._id,
    };
    if (statusFilter !== "ALL") {
      query.status = statusFilter;
    }
    if (page > 1) {
      query.page = String(page);
    }
    void router.replace({ pathname: "/chats", query }, undefined, { shallow: true });
  }, [availableHotels, hotelIdFromQuery, isStaff, page, router, statusFilter]);

  const { data: myChatsData, loading: myChatsLoading, error: myChatsError } = useQuery<GetMyChatsQueryData, GetMyChatsQueryVars>(
    GET_MY_CHATS_QUERY,
    {
      skip: !isUser,
      variables: { input: listInput },
      fetchPolicy: "cache-and-network",
    },
  );

  const { data: hotelChatsData, loading: hotelChatsLoading, error: hotelChatsError } = useQuery<
    GetHotelChatsQueryData,
    GetHotelChatsQueryVars
  >(GET_HOTEL_CHATS_QUERY, {
    skip: !isStaff || !selectedHotelId,
    variables: {
      hotelId: selectedHotelId,
      input: listInput,
      statusFilter: statusFilter === "ALL" ? undefined : statusFilter,
    },
    fetchPolicy: "cache-and-network",
  });

  const [startChat, { loading: startingChat }] = useMutation<StartChatMutationData, StartChatMutationVars>(START_CHAT_MUTATION);
  const [startHotelId, setStartHotelId] = useState("");
  const [startBookingId, setStartBookingId] = useState("");
  const [startMessage, setStartMessage] = useState("");

  useEffect(() => {
    if (!isUser) {
      return;
    }
    if (startHotelId || availableHotels.length === 0) {
      return;
    }
    setStartHotelId(availableHotels[0]._id);
  }, [availableHotels, isUser, startHotelId]);

  const chats = isStaff ? (hotelChatsData?.getHotelChats.list ?? []) : (myChatsData?.getMyChats.list ?? []);
  const total = isStaff ? (hotelChatsData?.getHotelChats.metaCounter.total ?? 0) : (myChatsData?.getMyChats.metaCounter.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const loading = isStaff ? hotelChatsLoading : myChatsLoading;
  const error = isStaff ? hotelChatsError : myChatsError;

  const pushQuery = (next: { hotelId?: string; status?: ChatStatus | "ALL"; page?: number }) => {
    const query: Record<string, string> = {};
    const nextHotelId = next.hotelId ?? selectedHotelId;
    const nextStatus = next.status ?? statusFilter;
    const nextPage = next.page ?? page;

    if (isStaff && nextHotelId) {
      query.hotelId = nextHotelId;
    }
    if (nextStatus !== "ALL") {
      query.status = nextStatus;
    }
    if (nextPage > 1) {
      query.page = String(nextPage);
    }

    void router.push({ pathname: "/chats", query }, undefined, { shallow: true });
  };

  const unreadForMe = (chat: ChatDto): number => {
    if (isUser) {
      return chat.unreadGuestMessages;
    }
    return chat.unreadAgentMessages;
  };

  const submitStartChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const hotelId = startHotelId.trim();
    const initialMessage = startMessage.trim();
    if (!hotelId) {
      toast.error("Hotel is required.");
      return;
    }
    if (!initialMessage) {
      toast.error("Initial message is required.");
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

      const chatId = response.data?.startChat._id;
      if (!chatId) {
        toast.error("Chat started but chat id was missing.");
        return;
      }

      toast.success("Chat started.");
      void router.push(`/chats/${chatId}`);
    } catch (mutationError) {
      toast.error(getErrorMessage(mutationError));
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
                onChange={(event) => pushQuery({ hotelId: event.target.value, page: 1 })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                disabled={availableHotels.length === 0}
              >
                {availableHotels.length === 0 ? <option value="">No hotels available</option> : null}
                {availableHotels.map((hotel) => (
                  <option key={hotel._id} value={hotel._id}>
                    {hotel.hotelTitle} ({hotel.hotelLocation})
                  </option>
                ))}
              </select>
            </label>
            <div>
              <p className="mb-2 block text-sm font-medium text-slate-700">Status</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => pushQuery({ status: "ALL", page: 1 })}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                    statusFilter === "ALL" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                  }`}
                >
                  ALL
                </button>
                {CHAT_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => pushQuery({ status, page: 1 })}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                      statusFilter === status ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {isUser ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Start New Chat</h2>
          <form onSubmit={submitStartChat} className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Hotel</span>
              <select
                value={startHotelId}
                onChange={(event) => setStartHotelId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2"
                required
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

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {getErrorMessage(error)}
        </section>
      ) : null}

      {loading && chats.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">Loading chats...</section>
      ) : null}

      {!loading && !error && chats.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No chats found.
        </section>
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
                  <p className="text-sm text-slate-600">Last activity: {formatDateTime(chat.lastMessageAt)}</p>
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
          Page {page} / {totalPages} · Total records: {total.toLocaleString()}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => pushQuery({ page: page - 1 })}
            disabled={page <= 1}
            className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => pushQuery({ page: page + 1 })}
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
