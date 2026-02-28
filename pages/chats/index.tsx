import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import {
  GET_HOTEL_CHATS_QUERY,
  GET_MY_CHATS_QUERY,
  START_CHAT_MUTATION,
} from "@/graphql/chat.gql";
import { GET_AGENT_HOTELS_QUERY, GET_HOTELS_QUERY } from "@/graphql/hotel.gql";
import { GET_MY_BOOKINGS_QUERY } from "@/graphql/booking.gql";
import { usePaginationQueryState } from "@/lib/hooks/use-pagination-query-state";
import { getSessionMember } from "@/lib/auth/session";
import { errorAlert } from "@/lib/ui/alerts";
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
import type {
  BookingListItem,
  GetMyBookingsQueryData,
  GetMyBookingsQueryVars,
} from "@/types/booking";
import type { NextPageWithAuth } from "@/types/page";
import {
  ArrowLeft,
  Building2,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Search,
  Send,
  SquarePen,
  X,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 20;
const HOTEL_LIST_LIMIT = 100;
const CHAT_STATUSES: ChatStatus[] = ["WAITING", "ACTIVE", "CLOSED"];

const STATUS_CONFIG: Record<
  ChatStatus,
  { label: string; dot: string; text: string }
> = {
  WAITING: { label: "Waiting", dot: "bg-amber-400", text: "text-amber-600" },
  ACTIVE: { label: "Active", dot: "bg-emerald-400", text: "text-emerald-600" },
  CLOSED: { label: "Closed", dot: "bg-slate-300", text: "text-slate-400" },
};

const AVATAR_COLORS = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-teal-500",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diffMs / 60000);
  const h = Math.floor(diffMs / 3600000);
  const d = Math.floor(diffMs / 86400000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  if (d === 1) return "Yesterday";
  if (d < 7)
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
      new Date(dateStr).getDay()
    ];
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function avatarBg(id: string): string {
  return AVATAR_COLORS[id.charCodeAt(id.length - 1) % AVATAR_COLORS.length];
}

function getLastMessagePreview(chat: ChatDto): string {
  const msg = chat.messages.at(-1);
  if (!msg) return "Start the conversation";
  if (msg.messageType === "IMAGE") return "Photo";
  if (msg.messageType === "FILE") return "Attachment";
  return msg.content?.trim() || "Message";
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ─── Hotel Avatar ─────────────────────────────────────────────────────────────

function HotelAvatar({
  name,
  id,
  status,
  size = "md",
}: {
  name: string;
  id: string;
  status?: ChatStatus;
  size?: "sm" | "md" | "lg";
}) {
  const color = avatarBg(id);
  const cls =
    size === "sm"
      ? "h-9 w-9 text-xs"
      : size === "lg"
        ? "h-14 w-14 text-lg"
        : "h-11 w-11 text-sm";
  return (
    <div className="relative flex-shrink-0">
      <div
        className={`flex ${cls} items-center justify-center rounded-full ${color} font-bold uppercase text-white`}
      >
        {name.charAt(0)}
      </div>
      {status === "ACTIVE" && (
        <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
      )}
      {status === "WAITING" && (
        <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
      )}
    </div>
  );
}

// ─── New Chat Overlay ─────────────────────────────────────────────────────────

function NewChatOverlay({
  availableHotels,
  myBookings,
  hotelsMap,
  preselectedHotelId = "",
  onClose,
  onSuccess,
}: {
  availableHotels: HotelListItem[];
  myBookings: BookingListItem[];
  hotelsMap: Map<string, HotelListItem>;
  preselectedHotelId?: string;
  onClose: () => void;
  onSuccess: (chatId: string) => void;
}) {
  const [step, setStep] = useState<"select" | "compose">("select");
  const [selectedHotel, setSelectedHotel] = useState<HotelListItem | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingListItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [startChat, { loading }] = useMutation<
    StartChatMutationData,
    StartChatMutationVars
  >(START_CHAT_MUTATION);

  // Auto-select hotel from query param once hotels are loaded
  useEffect(() => {
    if (!preselectedHotelId || selectedHotel || availableHotels.length === 0) return;
    const hotel = availableHotels.find((h) => h._id === preselectedHotelId);
    if (hotel) {
      setSelectedHotel(hotel);
      setStep("compose");
    }
  }, [availableHotels, preselectedHotelId, selectedHotel]);

  useEffect(() => {
    if (step === "select") setTimeout(() => searchRef.current?.focus(), 80);
    if (step === "compose") setTimeout(() => textareaRef.current?.focus(), 80);
  }, [step]);

  // Unique booked hotels (most-recent booking per hotel)
  const bookedHotels = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ booking: BookingListItem; hotel: HotelListItem }> = [];
    for (const booking of myBookings) {
      const hotel = hotelsMap.get(booking.hotelId);
      if (!seen.has(booking.hotelId) && hotel) {
        seen.add(booking.hotelId);
        result.push({ booking, hotel });
      }
    }
    return result;
  }, [myBookings, hotelsMap]);

  const filteredHotels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return availableHotels.slice(0, 40);
    return availableHotels.filter(
      (h) =>
        h.hotelTitle.toLowerCase().includes(q) ||
        h.hotelLocation.toLowerCase().includes(q),
    );
  }, [availableHotels, searchQuery]);

  const handleSelectHotel = (hotel: HotelListItem, booking?: BookingListItem) => {
    setSelectedHotel(hotel);
    setSelectedBooking(booking ?? null);
    setStep("compose");
  };

  const handleSend = async () => {
    if (!selectedHotel) return;
    const content = message.trim();
    if (!content) return;
    try {
      const input: StartChatMutationVars["input"] = {
        hotelId: selectedHotel._id,
        initialMessage: content,
      };
      if (selectedBooking?._id) input.bookingId = selectedBooking._id;
      const res = await startChat({ variables: { input } });
      const chatId = res.data?.startChat._id;
      if (!chatId) {
        await errorAlert("Error", "Chat was created but ID is missing.");
        return;
      }
      onSuccess(chatId);
    } catch (err) {
      await errorAlert("Could not start chat", getErrorMessage(err));
    }
  };

  return (
    <>
      <style>{`
        @keyframes overlaySlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes overlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes stepSlideLeft {
          from { opacity: 0; transform: translateX(16px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        style={{ animation: "overlayFadeIn 0.2s ease-out both" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92svh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[80vh] sm:w-[480px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
        style={{ animation: "overlaySlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) both" }}
      >
        {/* Drag handle (mobile) */}
        <div className="flex flex-none justify-center pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex flex-none items-center gap-3 px-5 py-4">
          <button
            type="button"
            onClick={step === "compose" ? () => setStep("select") : onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="flex-1 min-w-0">
            {step === "select" ? (
              <p className="font-semibold text-slate-900">New conversation</p>
            ) : (
              <>
                <p className="truncate font-semibold text-slate-900">
                  {selectedHotel?.hotelTitle}
                </p>
                <p className="text-xs text-slate-400">
                  {selectedHotel?.hotelLocation}
                </p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-100" />

        {/* ── Step 1: Select hotel ── */}
        {step === "select" && (
          <div
            className="flex flex-1 flex-col overflow-hidden"
            style={{ animation: "stepSlideLeft 0.2s ease-out both" }}
          >
            <div className="px-5 pt-4 pb-3">
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 transition focus-within:border-slate-300 focus-within:bg-white">
                <Search size={14} className="flex-shrink-0 text-slate-400" />
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search hotels by name or city…"
                  className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="flex-shrink-0 text-slate-400 transition hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-4">
              {/* From bookings */}
              {!searchQuery && bookedHotels.length > 0 && (
                <div className="mb-2">
                  <p className="px-5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    From your bookings
                  </p>
                  {bookedHotels.map(({ booking, hotel }) => (
                    <button
                      key={booking._id}
                      type="button"
                      onClick={() => handleSelectHotel(hotel, booking)}
                      className="flex w-full items-center gap-3.5 px-5 py-3 text-left transition hover:bg-slate-50"
                    >
                      <HotelAvatar name={hotel.hotelTitle} id={hotel._id} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {hotel.hotelTitle}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1">
                          <CalendarCheck size={10} className="flex-shrink-0 text-slate-400" />
                          <p className="truncate text-xs text-slate-400">
                            #{booking.bookingCode} · {fmtDate(booking.checkInDate)} –{" "}
                            {fmtDate(booking.checkOutDate)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          booking.bookingStatus === "CONFIRMED" ||
                          booking.bookingStatus === "CHECKED_IN"
                            ? "bg-emerald-50 text-emerald-700"
                            : booking.bookingStatus === "CANCELLED"
                              ? "bg-rose-50 text-rose-600"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {booking.bookingStatus}
                      </span>
                    </button>
                  ))}
                  <div className="mx-5 my-2 h-px bg-slate-100" />
                </div>
              )}

              {/* All hotels */}
              <div>
                <p className="px-5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {searchQuery ? `Results (${filteredHotels.length})` : "All hotels"}
                </p>
                {filteredHotels.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Building2 size={24} className="mb-2 text-slate-200" />
                    <p className="text-sm text-slate-400">No hotels found</p>
                  </div>
                ) : (
                  filteredHotels.map((hotel) => (
                    <button
                      key={hotel._id}
                      type="button"
                      onClick={() => handleSelectHotel(hotel)}
                      className="flex w-full items-center gap-3.5 px-5 py-3 text-left transition hover:bg-slate-50"
                    >
                      <HotelAvatar name={hotel.hotelTitle} id={hotel._id} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {hotel.hotelTitle}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          {hotel.hotelLocation} · {hotel.hotelType}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Compose ── */}
        {step === "compose" && selectedHotel && (
          <div
            className="flex flex-1 flex-col overflow-hidden"
            style={{ animation: "stepSlideLeft 0.2s ease-out both" }}
          >
            {/* Hotel info */}
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
              <HotelAvatar name={selectedHotel.hotelTitle} id={selectedHotel._id} size="lg" />
              <p className="mt-4 text-base font-bold text-slate-900">
                {selectedHotel.hotelTitle}
              </p>
              <p className="mt-0.5 text-sm text-slate-500">{selectedHotel.hotelLocation}</p>
              {selectedBooking && (
                <div className="mt-4 flex items-center gap-1.5 rounded-xl bg-sky-50 px-3.5 py-2 text-xs text-sky-700">
                  <CalendarCheck size={12} />
                  <span>
                    Booking{" "}
                    <span className="font-semibold">
                      #{selectedBooking.bookingCode}
                    </span>
                    {" · "}
                    {fmtDate(selectedBooking.checkInDate)} –{" "}
                    {fmtDate(selectedBooking.checkOutDate)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedBooking(null)}
                    className="ml-0.5 text-sky-400 transition hover:text-sky-600"
                  >
                    <X size={11} />
                  </button>
                </div>
              )}
              <p className="mt-5 max-w-[260px] text-xs text-slate-400">
                Messages are private between you and the hotel team.
              </p>
            </div>

            {/* Input */}
            <div className="flex-none border-t border-slate-100 bg-white px-4 pb-5 pt-3">
              <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm transition focus-within:border-slate-300 focus-within:shadow-md">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    const el = e.target;
                    el.style.height = "auto";
                    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
                  }}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Write your message…"
                  rows={1}
                  className="flex-1 resize-none bg-transparent py-1 text-sm text-slate-900 placeholder-slate-400 outline-none"
                  style={{ minHeight: "36px", maxHeight: "140px" }}
                />
                <button
                  type="button"
                  onClick={() => { void handleSend(); }}
                  disabled={!message.trim() || loading}
                  className={`mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-all ${
                    message.trim()
                      ? "bg-sky-500 text-white shadow-sm hover:bg-sky-600 active:scale-95"
                      : "text-slate-300"
                  }`}
                >
                  <Send size={15} />
                </button>
              </div>
              {message.trim() && (
                <p className="mt-1 text-right text-[10px] text-slate-400">⌘↩ to send</p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ChatsPage: NextPageWithAuth = () => {
  const router = useRouter();
  const member = useMemo(() => getSessionMember(), []);
  const memberType = member?.memberType;
  const isUser = memberType === "USER";
  const isAgent = memberType === "AGENT";
  const isStaff =
    isAgent || memberType === "ADMIN" || memberType === "ADMIN_OPERATOR";

  const [showNewChat, setShowNewChat] = useState(false);
  const [manualStaffHotelId, setManualStaffHotelId] = useState("");

  // Query param support: ?openNew=1&openHotelId=XXX
  const openNewFromQuery = router.query.openNew === "1";
  const openHotelIdFromQuery =
    typeof router.query.openHotelId === "string" ? router.query.openHotelId : "";

  const { page, statusFilter, getParam, pushQuery, replaceQuery } =
    usePaginationQueryState<ChatStatus>({
      pathname: "/chats",
      statusValues: CHAT_STATUSES,
    });
  const hotelIdFromQuery = getParam("hotelId");

  const listInput = useMemo<PaginationInput>(
    () => ({ page, limit: PAGE_LIMIT, sort: "lastMessageAt", direction: -1 }),
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
  const bookingsInput = useMemo(
    () => ({ page: 1, limit: 20, sort: "createdAt", direction: -1 as const }),
    [],
  );

  /** QUERIES **/

  const { data: agentHotelsData, loading: agentHotelsLoading } = useQuery<
    GetAgentHotelsQueryData,
    GetAgentHotelsQueryVars
  >(GET_AGENT_HOTELS_QUERY, {
    skip: !isAgent,
    variables: { input: hotelsInput },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const { data: publicHotelsData } = useQuery<GetHotelsQueryData, GetHotelsQueryVars>(
    GET_HOTELS_QUERY,
    {
      variables: { input: hotelsInput },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  const hotelsMap = useMemo<Map<string, HotelListItem>>(() => {
    const map = new Map<string, HotelListItem>();
    for (const h of publicHotelsData?.getHotels.list ?? []) map.set(h._id, h);
    return map;
  }, [publicHotelsData]);

  const availableHotels = useMemo<HotelListItem[]>(
    () =>
      isAgent
        ? (agentHotelsData?.getAgentHotels.list ?? [])
        : (publicHotelsData?.getHotels.list ?? []),
    [agentHotelsData, isAgent, publicHotelsData],
  );

  const { data: bookingsData } = useQuery<GetMyBookingsQueryData, GetMyBookingsQueryVars>(
    GET_MY_BOOKINGS_QUERY,
    {
      skip: !isUser,
      variables: { input: bookingsInput },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );
  const myBookings = useMemo(
    () => bookingsData?.getMyBookings.list ?? [],
    [bookingsData],
  );

  const selectedHotelId = isStaff
    ? hotelIdFromQuery || manualStaffHotelId.trim() || availableHotels[0]?._id || ""
    : "";

  const {
    data: myChatsData,
    loading: myChatsLoading,
    error: myChatsError,
  } = useQuery<GetMyChatsQueryData, GetMyChatsQueryVars>(GET_MY_CHATS_QUERY, {
    skip: !isUser,
    variables: { input: listInput },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const {
    data: hotelChatsData,
    loading: hotelChatsLoading,
    error: hotelChatsError,
  } = useQuery<GetHotelChatsQueryData, GetHotelChatsQueryVars>(
    GET_HOTEL_CHATS_QUERY,
    {
      skip: !isStaff || !selectedHotelId,
      variables: {
        hotelId: selectedHotelId,
        input: listInput,
        statusFilter: statusFilter === "ALL" ? undefined : statusFilter,
      },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  /** EFFECTS **/

  useEffect(() => {
    if (!isStaff || !hotelIdFromQuery) return;
    setManualStaffHotelId(hotelIdFromQuery);
  }, [hotelIdFromQuery, isStaff]);

  useEffect(() => {
    if (!isStaff || hotelIdFromQuery || availableHotels.length === 0) return;
    replaceQuery({ extra: { hotelId: availableHotels[0]._id } });
  }, [availableHotels, hotelIdFromQuery, isStaff, replaceQuery]);

  // Auto-open overlay from query param (e.g. from hotel detail page)
  useEffect(() => {
    if (!openNewFromQuery || !isUser) return;
    setShowNewChat(true);
    void router.replace("/chats", undefined, { shallow: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNewFromQuery, isUser]);

  /** COMPUTED **/

  const chats = isStaff
    ? (hotelChatsData?.getHotelChats.list ?? [])
    : (myChatsData?.getMyChats.list ?? []);
  const total = isStaff
    ? (hotelChatsData?.getHotelChats.metaCounter.total ?? 0)
    : (myChatsData?.getMyChats.metaCounter.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
  const loading = isStaff ? hotelChatsLoading : myChatsLoading;
  const error = isStaff ? hotelChatsError : myChatsError;
  const hotelsLoading = agentHotelsLoading;

  const unreadForMe = (chat: ChatDto) =>
    isUser ? chat.unreadGuestMessages : chat.unreadAgentMessages;

  const pushChatsQuery = (next: {
    hotelId?: string;
    status?: ChatStatus | "ALL";
    page?: number;
  }) => {
    pushQuery({
      page: next.page,
      status: next.status,
      extra: isStaff ? { hotelId: next.hotelId ?? selectedHotelId } : undefined,
    });
  };

  return (
    <>
      <style>{`
        @keyframes chatFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* New chat overlay */}
      {showNewChat && isUser && (
        <NewChatOverlay
          availableHotels={publicHotelsData?.getHotels.list ?? []}
          myBookings={myBookings}
          hotelsMap={hotelsMap}
          preselectedHotelId={openHotelIdFromQuery}
          onClose={() => setShowNewChat(false)}
          onSuccess={(chatId) => {
            setShowNewChat(false);
            void router.push(`/chats/${chatId}`);
          }}
        />
      )}

      <main className="mx-auto max-w-2xl space-y-4">
        {/* ── Page header ── */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Inbox
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Messages</h1>
          </div>
          {isUser && (
            <button
              type="button"
              onClick={() => setShowNewChat(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow"
              aria-label="New conversation"
            >
              <SquarePen size={15} className="text-slate-500" />
              New message
            </button>
          )}
        </div>

        {/* ── Staff: property + status filters ── */}
        {isStaff && (
          <div className="space-y-3">
            {hotelsLoading ? (
              <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <select
                value={selectedHotelId}
                onChange={(e) => {
                  setManualStaffHotelId(e.target.value);
                  pushChatsQuery({ hotelId: e.target.value, page: 1 });
                }}
                disabled={availableHotels.length === 0}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none ring-sky-400 transition focus:ring-2"
              >
                {availableHotels.length === 0 && (
                  <option value="">No hotels available</option>
                )}
                {availableHotels.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.hotelTitle} — {h.hotelLocation}
                  </option>
                ))}
              </select>
            )}
            <div className="flex flex-wrap gap-1.5">
              {(["ALL", ...CHAT_STATUSES] as const).map((s) => {
                const isSelected = statusFilter === s;
                const cfg = s !== "ALL" ? STATUS_CONFIG[s as ChatStatus] : null;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      pushChatsQuery({ status: s as ChatStatus | "ALL", page: 1 })
                    }
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      isSelected
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cfg && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isSelected ? "bg-white/70" : cfg.dot
                        }`}
                      />
                    )}
                    {s === "ALL" ? "All" : cfg?.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error ? <ErrorNotice message={getErrorMessage(error)} /> : null}

        {/* ── Loading skeletons ── */}
        {loading && chats.length === 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3.5 border-b border-slate-50 px-5 py-4 last:border-b-0"
              >
                <div className="h-11 w-11 flex-shrink-0 animate-pulse rounded-full bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-3.5 w-1/3 animate-pulse rounded-full bg-slate-100" />
                    <div className="h-3 w-8 animate-pulse rounded-full bg-slate-100" />
                  </div>
                  <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && chats.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 text-center shadow-sm">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50">
              <MessageSquare size={22} className="text-slate-400" />
            </div>
            <p className="font-semibold text-slate-800">No conversations yet</p>
            <p className="mt-1.5 max-w-[220px] text-sm text-slate-400">
              {isUser
                ? "Start a conversation with any hotel"
                : "No chats match the current filter"}
            </p>
            {isUser && (
              <button
                type="button"
                onClick={() => setShowNewChat(true)}
                className="mt-6 flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 active:scale-95"
              >
                <SquarePen size={14} />
                New conversation
              </button>
            )}
          </div>
        )}

        {/* ── Chat list ── */}
        {chats.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {chats.map((chat, i) => {
              const hotel = hotelsMap.get(chat.hotelId);
              const hotelName = hotel?.hotelTitle ?? "Hotel Support";
              const unread = unreadForMe(chat);
              const preview = getLastMessagePreview(chat);
              const time = timeAgo(chat.lastMessageAt);
              const lastMsg = chat.messages.at(-1);
              const isLastMsgFromMe =
                (lastMsg?.senderType === "GUEST" && isUser) ||
                (lastMsg?.senderType === "AGENT" && !isUser);
              const statusCfg = STATUS_CONFIG[chat.chatStatus];

              return (
                <Link
                  key={chat._id}
                  href={`/chats/${chat._id}`}
                  className={`group flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50 ${
                    i < chats.length - 1 ? "border-b border-slate-50" : ""
                  }`}
                  style={{
                    animation: "chatFadeIn 0.25s ease-out both",
                    animationDelay: `${i * 35}ms`,
                  }}
                >
                  <HotelAvatar name={hotelName} id={chat._id} status={chat.chatStatus} />

                  <div className="min-w-0 flex-1">
                    {/* Row 1: name + time */}
                    <div className="flex items-baseline justify-between gap-2">
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
                        className={`flex-shrink-0 text-[11px] ${
                          unread > 0 ? "font-semibold text-sky-500" : "text-slate-400"
                        }`}
                      >
                        {time}
                      </span>
                    </div>

                    {/* Row 2: preview + unread */}
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1">
                        {isLastMsgFromMe && !isUser && (
                          <Check size={12} className="flex-shrink-0 text-slate-400" />
                        )}
                        <p
                          className={`truncate text-sm ${
                            unread > 0
                              ? "font-medium text-slate-700"
                              : "text-slate-400"
                          }`}
                        >
                          {preview}
                        </p>
                      </div>
                      {unread > 0 && (
                        <span className="flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-full bg-sky-500 px-1.5 text-[10px] font-bold text-white">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </div>

                    {/* Row 3: status */}
                    <div className="mt-1 flex items-center gap-1">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          chat.chatStatus === "ACTIVE"
                            ? "animate-pulse bg-emerald-400"
                            : statusCfg.dot
                        }`}
                      />
                      <span className={`text-[10px] ${statusCfg.text}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* ── Pagination ── */}
        {total > PAGE_LIMIT && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Page <span className="font-semibold text-slate-800">{page}</span> of{" "}
              <span className="font-semibold text-slate-800">{totalPages}</span>
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => pushChatsQuery({ page: page - 1 })}
                disabled={page <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => pushChatsQuery({ page: page + 1 })}
                disabled={page >= totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
};

ChatsPage.auth = {
  roles: ["USER", "AGENT", "ADMIN", "ADMIN_OPERATOR"],
};

export default ChatsPage;
