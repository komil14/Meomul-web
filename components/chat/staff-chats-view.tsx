import { useQuery } from "@apollo/client/react";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Headset,
  MessageSquare,
  Search,
  X,
} from "lucide-react";
import {
  GET_HOTEL_CHATS_QUERY,
  GET_MY_CHATS_QUERY,
} from "@/graphql/chat.gql";
import {
  SUPPORT_CHAT_TITLE,
  avatarBg,
  getLastPreview,
  timeAgo,
} from "@/lib/chat/chat-helpers";
import type {
  ChatDto,
  ChatStatus,
  GetHotelChatsQueryData,
  GetHotelChatsQueryVars,
  GetMyChatsQueryData,
  GetMyChatsQueryVars,
} from "@/types/chat";
import type { HotelListItem } from "@/types/hotel";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 20;
const CHAT_STATUSES: ChatStatus[] = ["WAITING", "ACTIVE", "CLOSED"];

const STATUS_CONFIG: Record<ChatStatus, { label: string; dot: string }> = {
  WAITING: { label: "Waiting", dot: "bg-amber-400" },
  ACTIVE:  { label: "Active",  dot: "bg-emerald-400" },
  CLOSED:  { label: "Closed",  dot: "bg-slate-300" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function guestLabel(chat: ChatDto): string {
  return `Guest ···${chat.guestId.slice(-6).toUpperCase()}`;
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ChatStatus }) {
  return (
    <span
      className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        status === "WAITING"
          ? "bg-amber-50 text-amber-600"
          : status === "ACTIVE"
            ? "bg-emerald-50 text-emerald-600"
            : "bg-slate-100 text-slate-400"
      }`}
    >
      {STATUS_CONFIG[status].label}
    </span>
  );
}

// ─── HotelSidebarRow ──────────────────────────────────────────────────────────

function HotelSidebarRow({
  hotel,
  isSelected,
  onSelect,
}: {
  hotel: HotelListItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { data } = useQuery<GetHotelChatsQueryData, GetHotelChatsQueryVars>(
    GET_HOTEL_CHATS_QUERY,
    {
      variables: {
        hotelId: hotel._id,
        input: { page: 1, limit: 50, sort: "lastMessageAt", direction: -1 },
      },
      fetchPolicy: "cache-and-network",
      pollInterval: 30_000,
    },
  );

  const unread = useMemo(
    () =>
      (data?.getHotelChats.list ?? []).reduce(
        (sum, c) => sum + (c.unreadAgentMessages ?? 0),
        0,
      ),
    [data],
  );
  const waitingCount = useMemo(
    () =>
      (data?.getHotelChats.list ?? []).filter(
        (c) => c.chatStatus === "WAITING",
      ).length,
    [data],
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left transition
        lg:w-full lg:gap-2.5 lg:py-2.5
        ${isSelected ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
    >
      {/* Avatar — desktop only */}
      <div
        className={`hidden h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white lg:flex
          ${isSelected ? "bg-white/20" : avatarBg(hotel._id)}`}
      >
        {hotel.hotelTitle.charAt(0)}
      </div>
      <span className="max-w-[100px] truncate text-sm font-medium lg:max-w-none lg:flex-1">
        {hotel.hotelTitle}
      </span>
      {/* Waiting badge (amber) */}
      {waitingCount > 0 && (
        <span
          className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            isSelected
              ? "bg-amber-400 text-slate-900"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {waitingCount}
        </span>
      )}
      {/* Unread dot */}
      {unread > 0 && waitingCount === 0 && (
        <span
          className={`h-2 w-2 flex-shrink-0 rounded-full ${
            isSelected ? "bg-sky-400" : "bg-sky-500"
          }`}
        />
      )}
    </button>
  );
}

// ─── StaffChatsView ───────────────────────────────────────────────────────────

interface StaffChatsViewProps {
  availableHotels: HotelListItem[];
  hotelsLoading: boolean;
  memberType: "AGENT" | "ADMIN" | "ADMIN_OPERATOR";
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
}

export function StaffChatsView({
  availableHotels,
  hotelsLoading,
  memberType,
  onSelectChat,
  onNewChat,
}: StaffChatsViewProps) {
  const isAdmin = memberType === "ADMIN" || memberType === "ADMIN_OPERATOR";

  const [activeTab, setActiveTab] = useState<"hotels" | "support">("hotels");
  const [selectedHotelId, setSelectedHotelId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<ChatStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [hotelSearchQuery, setHotelSearchQuery] = useState("");

  // Auto-select first hotel when list loads
  useEffect(() => {
    if (!selectedHotelId && availableHotels.length > 0) {
      setSelectedHotelId(availableHotels[0]._id);
    }
  }, [availableHotels, selectedHotelId]);

  const filteredHotels = useMemo(() => {
    const q = hotelSearchQuery.trim().toLowerCase();
    if (!q) return availableHotels;
    return availableHotels.filter(
      (h) =>
        h.hotelTitle.toLowerCase().includes(q) ||
        h.hotelLocation.toLowerCase().includes(q),
    );
  }, [availableHotels, hotelSearchQuery]);

  const selectedHotel = useMemo(
    () => availableHotels.find((h) => h._id === selectedHotelId) ?? null,
    [availableHotels, selectedHotelId],
  );

  // ─── Hotel chats query ────────────────────────────────────────────────────

  const {
    data: hotelChatsData,
    loading: hotelChatsLoading,
  } = useQuery<GetHotelChatsQueryData, GetHotelChatsQueryVars>(
    GET_HOTEL_CHATS_QUERY,
    {
      skip: activeTab !== "hotels" || !selectedHotelId,
      variables: {
        hotelId: selectedHotelId,
        input: { page, limit: PAGE_LIMIT, sort: "lastMessageAt", direction: -1 },
        statusFilter: statusFilter === "ALL" ? undefined : statusFilter,
      },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
      pollInterval: 15_000,
    },
  );

  // ─── Support chats query ──────────────────────────────────────────────────

  const {
    data: supportChatsData,
    loading: supportChatsLoading,
  } = useQuery<GetMyChatsQueryData, GetMyChatsQueryVars>(GET_MY_CHATS_QUERY, {
    skip: activeTab !== "support",
    variables: {
      input: { page: 1, limit: 30, sort: "lastMessageAt", direction: -1 },
    },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
    pollInterval: 15_000,
  });

  // ─── Derived data ─────────────────────────────────────────────────────────

  const displayChats: ChatDto[] = useMemo(() => {
    if (activeTab === "support") {
      return (supportChatsData?.getMyChats.list ?? []).filter(
        (c) => c.chatScope === "SUPPORT",
      );
    }
    return hotelChatsData?.getHotelChats.list ?? [];
  }, [activeTab, hotelChatsData, supportChatsData]);

  const total =
    activeTab === "hotels"
      ? (hotelChatsData?.getHotelChats.metaCounter.total ?? 0)
      : 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
  const loading = activeTab === "hotels" ? hotelChatsLoading : supportChatsLoading;

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSelectHotel = (hotelId: string) => {
    setActiveTab("hotels");
    setSelectedHotelId(hotelId);
    setPage(1);
  };

  const handleStatusFilter = (s: ChatStatus | "ALL") => {
    setStatusFilter(s);
    setPage(1);
  };

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col lg:flex-row">

      {/* ── Sidebar ── */}
      <aside className="flex flex-none flex-col border-b border-slate-200 bg-white lg:h-full lg:w-60 lg:border-b-0 lg:border-r">

        {/* Admin: hotel search */}
        {isAdmin && (
          <div className="hidden p-3 pb-2 lg:block">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition focus-within:border-slate-300 focus-within:bg-white">
              <Search size={13} className="flex-shrink-0 text-slate-400" />
              <input
                value={hotelSearchQuery}
                onChange={(e) => setHotelSearchQuery(e.target.value)}
                placeholder="Search hotels…"
                className="flex-1 bg-transparent text-xs text-slate-900 placeholder-slate-400 outline-none"
              />
              {hotelSearchQuery && (
                <button
                  type="button"
                  onClick={() => setHotelSearchQuery("")}
                  className="flex-shrink-0 text-slate-400 transition hover:text-slate-600"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Hotel list */}
        <nav className="flex gap-1.5 overflow-x-auto p-3 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
          {hotelsLoading ? (
            <>
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 w-28 flex-shrink-0 animate-pulse rounded-xl bg-slate-100 lg:w-full"
                />
              ))}
            </>
          ) : filteredHotels.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">No hotels found</p>
          ) : (
            filteredHotels.map((hotel) => (
              <HotelSidebarRow
                key={hotel._id}
                hotel={hotel}
                isSelected={activeTab === "hotels" && selectedHotelId === hotel._id}
                onSelect={() => handleSelectHotel(hotel._id)}
              />
            ))
          )}
        </nav>

        {/* Support tab */}
        <div className="flex-none border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={() => {
              setActiveTab("support");
              setPage(1);
            }}
            className={`flex flex-shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left transition
              lg:w-full lg:gap-2.5 lg:py-2.5
              ${activeTab === "support" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            <div
              className={`hidden h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg lg:flex
                ${activeTab === "support" ? "bg-white/20" : "bg-teal-100"}`}
            >
              <Headset
                size={14}
                className={activeTab === "support" ? "text-white" : "text-teal-600"}
              />
            </div>
            <Headset
              size={14}
              className={`lg:hidden ${activeTab === "support" ? "text-white" : "text-teal-500"}`}
            />
            <span className="text-sm font-medium">Support</span>
          </button>
        </div>
      </aside>

      {/* ── Main panel ── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">

        {/* Panel header */}
        <div className="flex flex-none items-center gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold text-slate-900">
              {activeTab === "support"
                ? SUPPORT_CHAT_TITLE
                : (selectedHotel?.hotelTitle ?? "Select a hotel")}
            </h2>
            {activeTab === "hotels" && selectedHotel && (
              <p className="truncate text-xs text-slate-400">
                {selectedHotel.hotelLocation}
              </p>
            )}
            {activeTab === "support" && (
              <p className="text-xs text-slate-400">
                Your support conversations with platform admin
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onNewChat}
            className="flex-shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            {activeTab === "support" ? "Contact Admin" : "New chat"}
          </button>
        </div>

        {/* Status filter tabs (hotels only) */}
        {activeTab === "hotels" && (
          <div className="flex flex-none items-center gap-1.5 overflow-x-auto border-b border-slate-100 bg-white px-5 py-3">
            {(["ALL", ...CHAT_STATUSES] as const).map((s) => {
              const isSelected = statusFilter === s;
              const cfg = s !== "ALL" ? STATUS_CONFIG[s as ChatStatus] : null;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStatusFilter(s as ChatStatus | "ALL")}
                  className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
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
        )}

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30">

          {/* Loading skeletons */}
          {loading && displayChats.length === 0 && (
            <div className="divide-y divide-slate-50 bg-white">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3.5 px-5 py-4">
                  <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-full bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="h-3.5 w-1/4 animate-pulse rounded-full bg-slate-100" />
                      <div className="h-3 w-8 animate-pulse rounded-full bg-slate-100" />
                    </div>
                    <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && displayChats.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 bg-white shadow-sm">
                {activeTab === "support" ? (
                  <Headset size={20} className="text-slate-400" />
                ) : (
                  <MessageSquare size={20} className="text-slate-400" />
                )}
              </div>
              <p className="font-semibold text-slate-700">No conversations</p>
              <p className="mt-1 max-w-[200px] text-sm text-slate-400">
                {activeTab === "support"
                  ? "No support conversations yet"
                  : statusFilter !== "ALL"
                    ? `No ${STATUS_CONFIG[statusFilter as ChatStatus]?.label.toLowerCase()} chats`
                    : "No guest conversations yet"}
              </p>
            </div>
          )}

          {/* Chat items */}
          {displayChats.length > 0 && (
            <div className="divide-y divide-slate-50 bg-white">
              {displayChats.map((chat, i) => {
                const preview = getLastPreview(chat);
                const time = timeAgo(chat.lastMessageAt);
                const unread = chat.unreadAgentMessages;
                const title =
                  activeTab === "support"
                    ? SUPPORT_CHAT_TITLE
                    : guestLabel(chat);

                return (
                  <button
                    key={chat._id}
                    type="button"
                    onClick={() => onSelectChat(chat._id)}
                    className="flex w-full items-start gap-3.5 bg-white px-5 py-4 text-left transition hover:bg-slate-50"
                    style={{
                      animation: "staffChatFadeIn 0.2s ease-out both",
                      animationDelay: `${i * 25}ms`,
                    }}
                  >
                    {/* Avatar */}
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                        activeTab === "support"
                          ? "bg-teal-500"
                          : avatarBg(chat.guestId)
                      }`}
                    >
                      {activeTab === "support" ? (
                        <Headset size={16} />
                      ) : (
                        chat.guestId.charAt(chat.guestId.length - 1).toUpperCase()
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-sm font-semibold ${
                            unread > 0 ? "text-slate-900" : "text-slate-700"
                          }`}
                        >
                          {title}
                        </span>
                        <span className="flex-shrink-0 text-[10px] text-slate-400">
                          {time}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p
                          className={`flex-1 truncate text-xs ${
                            unread > 0
                              ? "font-medium text-slate-700"
                              : "text-slate-500"
                          }`}
                        >
                          {preview}
                        </p>
                        <StatusBadge status={chat.chatStatus} />
                        {unread > 0 && (
                          <span className="flex-shrink-0 rounded-full bg-sky-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination (hotels tab only) */}
        {activeTab === "hotels" && totalPages > 1 && (
          <div className="flex flex-none items-center justify-between border-t border-slate-100 bg-white px-5 py-3">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronLeft size={13} />
              Prev
            </button>
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-30"
            >
              Next
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes staffChatFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
