import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import {
  GET_HOTEL_QUERY,
  GET_AGENT_ROOMS_QUERY,
  CREATE_ROOM_MUTATION,
  UPDATE_ROOM_MUTATION,
} from "@/graphql/hotel.gql";
import { getSessionMember } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/error";
import { successAlert, errorAlert } from "@/lib/ui/alerts";
import { formatCurrencyKrw } from "@/lib/utils/format";
import { resolveMediaUrl } from "@/lib/utils/media-url";
import type {
  AgentRoomListItem,
  AgentRoomCreateInput,
  AgentRoomUpdateInput,
  BedType,
  RoomStatus,
  RoomType,
  ViewType,
  GetAgentRoomsQueryData,
  GetAgentRoomsQueryVars,
  GetHotelQueryData,
  GetHotelQueryVars,
  CreateRoomMutationData,
  CreateRoomMutationVars,
  UpdateRoomMutationData,
  UpdateRoomMutationVars,
  PaginationInput,
} from "@/types/hotel";
import type { NextPageWithAuth } from "@/types/page";
import {
  ArrowLeft,
  BedDouble,
  Building2,
  ChevronDown,
  DoorOpen,
  Plus,
  Star,
  X,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROOM_PAGINATION: PaginationInput = {
  page: 1,
  limit: 100,
  sort: "createdAt",
  direction: -1,
};

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  STANDARD: "Standard",
  DELUXE: "Deluxe",
  PREMIUM: "Premium",
  SUITE: "Suite",
  FAMILY: "Family",
  PENTHOUSE: "Penthouse",
};

const BED_TYPE_LABELS: Record<BedType, string> = {
  SINGLE: "Single",
  DOUBLE: "Double",
  QUEEN: "Queen",
  KING: "King",
  TWIN: "Twin",
};

const VIEW_TYPE_LABELS: Record<ViewType, string> = {
  NONE: "No view",
  CITY: "City view",
  OCEAN: "Ocean view",
  MOUNTAIN: "Mountain view",
  GARDEN: "Garden view",
};

const ROOM_STATUS_CONFIG: Record<
  RoomStatus,
  { label: string; className: string; dotClass: string }
> = {
  AVAILABLE: {
    label: "Available",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    dotClass: "bg-emerald-500",
  },
  BOOKED: {
    label: "Booked",
    className: "bg-sky-50 text-sky-700 border border-sky-200",
    dotClass: "bg-sky-500",
  },
  MAINTENANCE: {
    label: "Maintenance",
    className: "bg-amber-50 text-amber-700 border border-amber-200",
    dotClass: "bg-amber-500",
  },
  INACTIVE: {
    label: "Inactive",
    className: "bg-slate-100 text-slate-500 border border-slate-200",
    dotClass: "bg-slate-400",
  },
};

const ROOM_AMENITY_OPTIONS = [
  { key: "AC", label: "Air Conditioning" },
  { key: "TV", label: "TV" },
  { key: "minibar", label: "Minibar" },
  { key: "coffeemaker", label: "Coffee Maker" },
  { key: "hairdryer", label: "Hair Dryer" },
  { key: "safe", label: "In-room Safe" },
  { key: "bathtub", label: "Bathtub" },
  { key: "balcony", label: "Balcony" },
  { key: "workspace", label: "Work Desk" },
  { key: "sofa", label: "Sofa" },
  { key: "kitchenette", label: "Kitchenette" },
  { key: "washer", label: "Washer" },
];

const EDITABLE_STATUSES: RoomStatus[] = [
  "AVAILABLE",
  "MAINTENANCE",
  "INACTIVE",
];

// ─── Types ────────────────────────────────────────────────────────────────────

type PanelMode = "closed" | "create" | "edit";

interface RoomFormState {
  roomName: string;
  roomType: RoomType;
  roomNumber: string;
  roomDesc: string;
  maxOccupancy: number;
  bedType: BedType;
  bedCount: number;
  basePrice: number;
  weekendSurcharge: number;
  roomSize: number;
  viewType: ViewType;
  totalRooms: number;
  roomAmenities: string[];
  roomImages: string;
}

const DEFAULT_FORM: RoomFormState = {
  roomName: "",
  roomType: "STANDARD",
  roomNumber: "",
  roomDesc: "",
  maxOccupancy: 2,
  bedType: "DOUBLE",
  bedCount: 1,
  basePrice: 0,
  weekendSurcharge: 0,
  roomSize: 0,
  viewType: "NONE",
  totalRooms: 1,
  roomAmenities: [],
  roomImages: "",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const HotelRoomsPage: NextPageWithAuth = () => {
  const router = useRouter();
  const hotelId =
    typeof router.query.hotelId === "string" ? router.query.hotelId : "";

  const [panelMode, setPanelMode] = useState<PanelMode>("closed");
  const [editingRoom, setEditingRoom] = useState<AgentRoomListItem | null>(
    null,
  );
  const [form, setForm] = useState<RoomFormState>(DEFAULT_FORM);
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: hotelData } = useQuery<GetHotelQueryData, GetHotelQueryVars>(
    GET_HOTEL_QUERY,
    { variables: { hotelId }, skip: !hotelId },
  );

  const {
    data: roomsData,
    loading: roomsLoading,
    error: roomsError,
    refetch: refetchRooms,
  } = useQuery<GetAgentRoomsQueryData, GetAgentRoomsQueryVars>(
    GET_AGENT_ROOMS_QUERY,
    {
      variables: { hotelId, input: ROOM_PAGINATION },
      skip: !hotelId,
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  // ── Mutations ─────────────────────────────────────────────────────────────

  const [createRoom, { loading: creating }] = useMutation<
    CreateRoomMutationData,
    CreateRoomMutationVars
  >(CREATE_ROOM_MUTATION);

  const [updateRoom, { loading: updating }] = useMutation<
    UpdateRoomMutationData,
    UpdateRoomMutationVars
  >(UPDATE_ROOM_MUTATION);

  // ── Derived ──────────────────────────────────────────────────────────────

  const hotel = hotelData?.getHotel;
  const rooms = roomsData?.getAgentRooms.list ?? [];

  // Ownership guard — redirect non-owners back to manage page
  const sessionMember = getSessionMember();
  const isOwner =
    !hotel ||
    hotel.memberId === sessionMember?._id ||
    sessionMember?.memberType === "ADMIN" ||
    sessionMember?.memberType === "ADMIN_OPERATOR";

  useEffect(() => {
    if (hotel && !isOwner) {
      void router.replace("/hotels/manage");
    }
  }, [hotel, isOwner, router]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const openCreate = () => {
    setForm(DEFAULT_FORM);
    setEditingRoom(null);
    setPanelMode("create");
  };

  const openEdit = (room: AgentRoomListItem) => {
    setEditingRoom(room);
    setForm({
      roomName: room.roomName,
      roomType: room.roomType,
      roomNumber: room.roomNumber ?? "",
      roomDesc: room.roomDesc,
      maxOccupancy: room.maxOccupancy,
      bedType: room.bedType,
      bedCount: room.bedCount,
      basePrice: room.basePrice,
      weekendSurcharge: room.weekendSurcharge,
      roomSize: room.roomSize,
      viewType: room.viewType,
      totalRooms: room.totalRooms,
      roomAmenities: [...room.roomAmenities],
      roomImages: room.roomImages.join("\n"),
    });
    setPanelMode("edit");
  };

  const closePanel = () => {
    setPanelMode("closed");
    setEditingRoom(null);
  };

  const toggleAmenity = (key: string) => {
    setForm((prev) => ({
      ...prev,
      roomAmenities: prev.roomAmenities.includes(key)
        ? prev.roomAmenities.filter((a) => a !== key)
        : [...prev.roomAmenities, key],
    }));
  };

  const handleSubmit = async () => {
    if (!form.roomName.trim()) {
      void errorAlert("Room name is required.");
      return;
    }
    if (form.basePrice <= 0) {
      void errorAlert("Base price must be greater than 0.");
      return;
    }
    if (form.maxOccupancy < 1) {
      void errorAlert("Max occupancy must be at least 1.");
      return;
    }

    const imagesList = form.roomImages
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);

    try {
      if (panelMode === "create") {
        const input: AgentRoomCreateInput = {
          hotelId,
          roomName: form.roomName.trim(),
          roomType: form.roomType,
          maxOccupancy: form.maxOccupancy,
          bedType: form.bedType,
          bedCount: form.bedCount,
          basePrice: form.basePrice,
          totalRooms: form.totalRooms,
          ...(form.roomNumber.trim() && { roomNumber: form.roomNumber.trim() }),
          ...(form.roomDesc.trim() && { roomDesc: form.roomDesc.trim() }),
          ...(form.weekendSurcharge > 0 && {
            weekendSurcharge: form.weekendSurcharge,
          }),
          ...(form.roomSize > 0 && { roomSize: form.roomSize }),
          viewType: form.viewType,
          roomAmenities: form.roomAmenities,
          ...(imagesList.length > 0 && { roomImages: imagesList }),
        };
        await createRoom({ variables: { input } });
        void successAlert("Room added successfully.");
      } else if (panelMode === "edit" && editingRoom) {
        const input: AgentRoomUpdateInput = {
          _id: editingRoom._id,
          roomName: form.roomName.trim(),
          roomDesc: form.roomDesc.trim(),
          basePrice: form.basePrice,
          weekendSurcharge: form.weekendSurcharge,
          roomSize: form.roomSize,
          viewType: form.viewType,
          roomAmenities: form.roomAmenities,
          totalRooms: form.totalRooms,
          roomImages: imagesList,
        };
        await updateRoom({ variables: { input } });
        void successAlert("Room updated successfully.");
      }
      closePanel();
      void refetchRooms();
    } catch (err) {
      void errorAlert(getErrorMessage(err));
    }
  };

  const handleStatusChange = async (
    room: AgentRoomListItem,
    newStatus: RoomStatus,
  ) => {
    setStatusDropdownId(null);
    try {
      await updateRoom({
        variables: { input: { _id: room._id, roomStatus: newStatus } },
      });
      void refetchRooms();
    } catch (err) {
      void errorAlert(getErrorMessage(err));
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!statusDropdownId) return;
    const handler = () => setStatusDropdownId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [statusDropdownId]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes panelSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        .room-panel { animation: panelSlideIn 0.22s ease-out; }

        @keyframes rowFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .room-row { animation: rowFadeIn 0.18s ease-out both; }
      `}</style>

      <main className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/hotels/${hotelId}/edit`}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition"
            >
              <ArrowLeft size={15} />
              Edit hotel
            </Link>
            <Link
              href={`/hotels/${hotelId}/reviews`}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition"
            >
              <Star size={15} />
              Reviews
            </Link>
            <span className="text-slate-300">/</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Room Management
              </p>
              <h1 className="mt-0.5 text-2xl font-semibold text-slate-900">
                {hotel?.hotelTitle ?? "Hotel"}{" "}
                {rooms.length > 0 && (
                  <span className="text-lg font-normal text-slate-400">
                    — {rooms.length} room{rooms.length !== 1 ? "s" : ""}
                  </span>
                )}
              </h1>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            <Plus size={15} />
            Add Room
          </button>
        </div>

        {/* Error */}
        {roomsError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {roomsError.message}
          </div>
        )}

        {/* Loading skeleton */}
        {roomsLoading && rooms.length === 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-slate-100 p-4 last:border-0"
              >
                <div className="h-16 w-24 animate-pulse rounded-xl bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 animate-pulse rounded-full bg-slate-100" />
                  <div className="h-3 w-1/4 animate-pulse rounded-full bg-slate-100" />
                </div>
                <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!roomsLoading && rooms.length === 0 && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-center">
            <DoorOpen size={40} className="text-slate-300" />
            <p className="mt-4 font-semibold text-slate-700">No rooms yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Add your first room type to start accepting bookings.
            </p>
            <button
              onClick={openCreate}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              <Plus size={14} />
              Add Room
            </button>
          </div>
        )}

        {/* Room table */}
        {rooms.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span>Room</span>
              <span>Type</span>
              <span>Price / night</span>
              <span>Status</span>
              <span />
            </div>

            {/* Rows */}
            {rooms.map((room, idx) => {
              const thumbnail = room.roomImages?.[0];
              const statusCfg = ROOM_STATUS_CONFIG[room.roomStatus];

              return (
                <div
                  key={room._id}
                  className="room-row grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-0 hover:bg-slate-50 transition"
                  style={{ animationDelay: `${idx * 0.04}s` }}
                >
                  {/* Room name + thumbnail */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveMediaUrl(thumbnail)}
                          alt={room.roomName}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <BedDouble size={20} className="text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {room.roomName}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {BED_TYPE_LABELS[room.bedType]} × {room.bedCount} · max{" "}
                        {room.maxOccupancy} guests
                      </p>
                      {room.roomNumber && (
                        <p className="mt-0.5 text-xs text-slate-400">
                          #{room.roomNumber}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Type */}
                  <span className="text-sm text-slate-600">
                    {ROOM_TYPE_LABELS[room.roomType]}
                  </span>

                  {/* Price */}
                  <span className="text-sm font-semibold text-slate-800">
                    {formatCurrencyKrw(room.basePrice)}
                    {room.weekendSurcharge > 0 && (
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        (+{formatCurrencyKrw(room.weekendSurcharge)} wknd)
                      </span>
                    )}
                  </span>

                  {/* Status badge + dropdown */}
                  <div className="relative">
                    <button
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition hover:opacity-80 ${statusCfg.className}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusDropdownId(
                          statusDropdownId === room._id ? null : room._id,
                        );
                      }}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${statusCfg.dotClass}`}
                      />
                      {statusCfg.label}
                      <ChevronDown size={10} />
                    </button>

                    {statusDropdownId === room._id && (
                      <div
                        className="absolute left-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {EDITABLE_STATUSES.map((s) => {
                          const cfg = ROOM_STATUS_CONFIG[s];
                          return (
                            <button
                              key={s}
                              className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold transition hover:bg-slate-50 ${
                                room.roomStatus === s ? "bg-slate-50" : ""
                              }`}
                              onClick={() => void handleStatusChange(room, s)}
                              disabled={updating}
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${cfg.dotClass}`}
                              />
                              {cfg.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Edit button */}
                  <button
                    onClick={() => openEdit(room)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Stats */}
        {rooms.length > 0 && (
          <p className="text-center text-xs text-slate-400">
            {rooms.length} room type{rooms.length !== 1 ? "s" : ""} registered
          </p>
        )}
      </main>

      {/* Slide-in Panel */}
      {panelMode !== "closed" && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
            onClick={closePanel}
          />

          {/* Panel */}
          <div className="room-panel fixed right-0 top-0 z-50 flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl">
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="font-semibold text-slate-900">
                {panelMode === "create" ? "Add New Room" : "Edit Room"}
              </h2>
              <button
                onClick={closePanel}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Basic Info */}
              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Basic Info
                </h3>

                {/* Room name */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Room Name *
                  </label>
                  <input
                    type="text"
                    value={form.roomName}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, roomName: e.target.value }))
                    }
                    placeholder="e.g. Deluxe Ocean View"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </div>

                {/* Room type + Room number */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Room Type
                    </label>
                    <select
                      value={form.roomType}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          roomType: e.target.value as RoomType,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                    >
                      {(Object.keys(ROOM_TYPE_LABELS) as RoomType[]).map(
                        (t) => (
                          <option key={t} value={t}>
                            {ROOM_TYPE_LABELS[t]}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Room Number
                    </label>
                    <input
                      type="text"
                      value={form.roomNumber}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, roomNumber: e.target.value }))
                      }
                      placeholder="e.g. 301 (optional)"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={form.roomDesc}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, roomDesc: e.target.value }))
                    }
                    placeholder="Describe the room's highlights..."
                    className="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </div>
              </section>

              {/* Capacity & Bed */}
              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Capacity & Bed
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  {/* Max occupancy */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Max Occupancy *
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            maxOccupancy: Math.max(1, p.maxOccupancy - 1),
                          }))
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        −
                      </button>
                      <span className="w-10 text-center text-sm font-semibold">
                        {form.maxOccupancy}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            maxOccupancy: p.maxOccupancy + 1,
                          }))
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Total rooms */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Total Rooms *
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            totalRooms: Math.max(1, p.totalRooms - 1),
                          }))
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        −
                      </button>
                      <span className="w-10 text-center text-sm font-semibold">
                        {form.totalRooms}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            totalRooms: p.totalRooms + 1,
                          }))
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Bed type */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Bed Type
                    </label>
                    <select
                      value={form.bedType}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          bedType: e.target.value as BedType,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                    >
                      {(Object.keys(BED_TYPE_LABELS) as BedType[]).map((t) => (
                        <option key={t} value={t}>
                          {BED_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Bed count */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Bed Count
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            bedCount: Math.max(1, p.bedCount - 1),
                          }))
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        −
                      </button>
                      <span className="w-10 text-center text-sm font-semibold">
                        {form.bedCount}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({ ...p, bedCount: p.bedCount + 1 }))
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Pricing */}
              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Pricing
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Base Price (₩) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.basePrice || ""}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          basePrice: Number(e.target.value),
                        }))
                      }
                      placeholder="100000"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Weekend Surcharge (₩)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.weekendSurcharge || ""}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          weekendSurcharge: Number(e.target.value),
                        }))
                      }
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                    />
                  </div>
                </div>
              </section>

              {/* Room details */}
              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Room Details
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Room Size (m²)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.roomSize || ""}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          roomSize: Number(e.target.value),
                        }))
                      }
                      placeholder="e.g. 28"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      View Type
                    </label>
                    <select
                      value={form.viewType}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          viewType: e.target.value as ViewType,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                    >
                      {(Object.keys(VIEW_TYPE_LABELS) as ViewType[]).map(
                        (v) => (
                          <option key={v} value={v}>
                            {VIEW_TYPE_LABELS[v]}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                </div>
              </section>

              {/* Room amenities */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Room Amenities
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {ROOM_AMENITY_OPTIONS.map(({ key, label }) => {
                    const active = form.roomAmenities.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleAmenity(key)}
                        className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                          active
                            ? "border-slate-700 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Room images */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Room Images
                </h3>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Image URLs (one per line)
                  </label>
                  <textarea
                    rows={3}
                    value={form.roomImages}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, roomImages: e.target.value }))
                    }
                    placeholder={"https://...\nhttps://..."}
                    className="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 font-mono text-xs text-slate-700 focus:border-slate-400 focus:outline-none"
                  />
                </div>
              </section>
            </div>

            {/* Panel footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                onClick={closePanel}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={creating || updating}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                {creating || updating
                  ? "Saving..."
                  : panelMode === "create"
                    ? "Add Room"
                    : "Save Changes"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

HotelRoomsPage.auth = {
  roles: ["AGENT", "ADMIN", "ADMIN_OPERATOR"],
};

export default HotelRoomsPage;
