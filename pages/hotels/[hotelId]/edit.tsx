import { useMutation, useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { GET_HOTEL_QUERY, UPDATE_HOTEL_MUTATION } from "@/graphql/hotel.gql";
import { getErrorMessage } from "@/lib/utils/error";
import { successAlert, errorAlert } from "@/lib/ui/alerts";
import type {
  AmenitiesInput,
  AgentHotelUpdateInput,
  CancellationPolicy,
  GetHotelQueryData,
  GetHotelQueryVars,
  SafetyFeaturesInput,
  UpdateHotelMutationData,
  UpdateHotelMutationVars,
} from "@/types/hotel";
import type { NextPageWithAuth } from "@/types/page";
import { ArrowLeft, Check, Save } from "lucide-react";

// ─── Config ───────────────────────────────────────────────────────────────────

const CANCELLATION_OPTIONS: Array<{
  value: CancellationPolicy;
  label: string;
  desc: string;
}> = [
  { value: "FLEXIBLE", label: "Flexible",  desc: "Free cancellation up to 24h before check-in" },
  { value: "MODERATE", label: "Moderate",  desc: "Free cancellation up to 5 days before check-in" },
  { value: "STRICT",   label: "Strict",    desc: "50% refund up to 7 days before check-in" },
];

const AMENITY_OPTIONS: Array<{ key: keyof AmenitiesInput; label: string }> = [
  { key: "wifi",                label: "Wi-Fi" },
  { key: "parking",             label: "Parking" },
  { key: "breakfast",           label: "Breakfast" },
  { key: "breakfastIncluded",   label: "Breakfast Included" },
  { key: "gym",                 label: "Gym" },
  { key: "pool",                label: "Pool" },
  { key: "spa",                 label: "Spa" },
  { key: "restaurant",          label: "Restaurant" },
  { key: "roomService",         label: "Room Service" },
  { key: "workspace",           label: "Business Center" },
  { key: "meetingRoom",         label: "Meeting Room" },
  { key: "familyRoom",          label: "Family Room" },
  { key: "kidsFriendly",        label: "Kids Friendly" },
  { key: "playground",          label: "Playground" },
  { key: "elevator",            label: "Elevator" },
  { key: "airportShuttle",      label: "Airport Shuttle" },
  { key: "evCharging",          label: "EV Charging" },
  { key: "wheelchairAccessible",label: "Wheelchair Accessible" },
  { key: "coupleRoom",          label: "Couple Room" },
  { key: "romanticView",        label: "Romantic View" },
  { key: "privateBath",         label: "Private Bathroom" },
];

const SAFETY_OPTIONS: Array<{ key: keyof SafetyFeaturesInput; label: string }> = [
  { key: "fireSafety",       label: "Fire Safety Equipment" },
  { key: "securityCameras",  label: "Security Cameras" },
  { key: "frontDesk24h",     label: "24h Front Desk" },
  { key: "roomSafe",         label: "In-Room Safe" },
  { key: "femaleOnlyFloors", label: "Female-Only Floors" },
  { key: "wellLitParking",   label: "Well-Lit Parking" },
];

const SUITABLE_FOR_OPTIONS = [
  "BUSINESS", "ROMANTIC", "FAMILY", "SOLO", "STAYCATION", "EVENT", "MEDICAL", "LONG_TERM",
] as const;

const SUITABLE_LABELS: Record<string, string> = {
  BUSINESS:   "Business",
  ROMANTIC:   "Romantic",
  FAMILY:     "Family",
  SOLO:       "Solo Travel",
  STAYCATION: "Staycation",
  EVENT:      "Events",
  MEDICAL:    "Medical",
  LONG_TERM:  "Long Term",
};

type Tab = "info" | "amenities" | "policies";

// ─── Page ─────────────────────────────────────────────────────────────────────

const EditHotelPage: NextPageWithAuth = () => {
  const router = useRouter();
  const hotelId = typeof router.query.hotelId === "string" ? router.query.hotelId : "";

  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [saving, setSaving]       = useState(false);

  // Info tab
  const [hotelTitle, setHotelTitle]     = useState("");
  const [hotelDesc, setHotelDesc]       = useState("");
  const [starRating, setStarRating]     = useState(3);
  const [checkInTime, setCheckInTime]   = useState("15:00");
  const [checkOutTime, setCheckOutTime] = useState("11:00");
  const [hotelImages, setHotelImages]   = useState("");
  const [suitableFor, setSuitableFor]   = useState<string[]>([]);

  // Amenities tab
  const [amenities, setAmenities]       = useState<AmenitiesInput>({});
  const [safetyFeatures, setSafetyFeatures] = useState<SafetyFeaturesInput>({});

  // Policies tab
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicy>("MODERATE");
  const [petsAllowed, setPetsAllowed]       = useState(false);
  const [maxPetWeight, setMaxPetWeight]     = useState("");
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [flexCheckInEnabled, setFlexCheckInEnabled]   = useState(false);
  const [flexCheckInFee, setFlexCheckInFee]           = useState("");
  const [flexCheckOutEnabled, setFlexCheckOutEnabled] = useState(false);
  const [flexCheckOutFee, setFlexCheckOutFee]         = useState("");

  // Load hotel
  const { data, loading: loadingHotel } = useQuery<GetHotelQueryData, GetHotelQueryVars>(
    GET_HOTEL_QUERY,
    {
      skip: !hotelId,
      variables: { hotelId },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  const hotel = data?.getHotel;

  // Pre-fill form when data loads
  useEffect(() => {
    if (!hotel) return;
    setHotelTitle(hotel.hotelTitle);
    setHotelDesc(hotel.hotelDesc ?? "");
    setStarRating(hotel.starRating ?? 3);
    setCheckInTime(hotel.checkInTime ?? "15:00");
    setCheckOutTime(hotel.checkOutTime ?? "11:00");
    setHotelImages((hotel.hotelImages ?? []).join("\n"));
    setSuitableFor(hotel.suitableFor ?? []);
    if (hotel.amenities) {
      setAmenities({
        wifi:                hotel.amenities.wifi,
        parking:             hotel.amenities.parking,
        breakfast:           hotel.amenities.breakfast,
        breakfastIncluded:   hotel.amenities.breakfastIncluded,
        roomService:         hotel.amenities.roomService,
        gym:                 hotel.amenities.gym,
        pool:                hotel.amenities.pool,
        workspace:           hotel.amenities.workspace,
        familyRoom:          hotel.amenities.familyRoom,
        kidsFriendly:        hotel.amenities.kidsFriendly,
        wheelchairAccessible:hotel.amenities.wheelchairAccessible,
        elevator:            hotel.amenities.elevator,
        accessibleBathroom:  hotel.amenities.accessibleBathroom,
        visualAlarms:        hotel.amenities.visualAlarms,
        serviceAnimalsAllowed: hotel.amenities.serviceAnimalsAllowed,
        airportShuttle:      hotel.amenities.airportShuttle,
        evCharging:          hotel.amenities.evCharging,
        playground:          hotel.amenities.playground,
        meetingRoom:         hotel.amenities.meetingRoom,
        privateBath:         hotel.amenities.privateBath,
        restaurant:          hotel.amenities.restaurant,
        spa:                 hotel.amenities.spa,
        coupleRoom:          hotel.amenities.coupleRoom,
        romanticView:        hotel.amenities.romanticView,
      });
    }
    if (hotel.safetyFeatures) {
      setSafetyFeatures({
        fireSafety:       hotel.safetyFeatures.fireSafety,
        securityCameras:  hotel.safetyFeatures.securityCameras,
        frontDesk24h:     hotel.safetyFeatures.frontDesk24h,
        roomSafe:         hotel.safetyFeatures.roomSafe,
        femaleOnlyFloors: hotel.safetyFeatures.femaleOnlyFloors,
        wellLitParking:   hotel.safetyFeatures.wellLitParking,
      });
    }
    setCancellationPolicy(hotel.cancellationPolicy ?? "MODERATE");
    setPetsAllowed(hotel.petsAllowed ?? false);
    setMaxPetWeight(hotel.maxPetWeight != null ? String(hotel.maxPetWeight) : "");
    setSmokingAllowed(hotel.smokingAllowed ?? false);
    setFlexCheckInEnabled(hotel.flexibleCheckIn?.enabled ?? false);
    setFlexCheckInFee(hotel.flexibleCheckIn?.fee != null ? String(hotel.flexibleCheckIn.fee) : "");
    setFlexCheckOutEnabled(hotel.flexibleCheckOut?.enabled ?? false);
    setFlexCheckOutFee(hotel.flexibleCheckOut?.fee != null ? String(hotel.flexibleCheckOut.fee) : "");
  }, [hotel]);

  const [updateHotel] = useMutation<UpdateHotelMutationData, UpdateHotelMutationVars>(
    UPDATE_HOTEL_MUTATION,
  );

  const handleSave = async () => {
    if (!hotelId) return;
    setSaving(true);
    try {
      const imageUrls = hotelImages.split("\n").map((u) => u.trim()).filter(Boolean);
      const input: AgentHotelUpdateInput = {
        _id: hotelId,
        hotelTitle:         hotelTitle.trim() || undefined,
        hotelDesc:          hotelDesc.trim() || undefined,
        starRating,
        checkInTime,
        checkOutTime,
        cancellationPolicy,
        petsAllowed,
        maxPetWeight:       petsAllowed && maxPetWeight ? Number(maxPetWeight) : undefined,
        smokingAllowed,
        amenities,
        safetyFeatures,
        suitableFor,
        hotelImages:        imageUrls,
        flexibleCheckIn:    {
          enabled: flexCheckInEnabled,
          fee: flexCheckInFee ? Number(flexCheckInFee) : 0,
        },
        flexibleCheckOut:   {
          enabled: flexCheckOutEnabled,
          fee: flexCheckOutFee ? Number(flexCheckOutFee) : 0,
        },
      };
      await updateHotel({ variables: { input } });
      successAlert("Hotel updated successfully.");
    } catch (err) {
      errorAlert(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleAmenity = (key: keyof AmenitiesInput) =>
    setAmenities((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleSafety = (key: keyof SafetyFeaturesInput) =>
    setSafetyFeatures((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleSuitableFor = (val: string) =>
    setSuitableFor((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );

  // ── Loading ──
  if (loadingHotel && !hotel) {
    return (
      <main className="max-w-2xl space-y-4">
        <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" />
        <div className="h-7 w-48 animate-pulse rounded-full bg-slate-200" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      </main>
    );
  }

  const TAB_CLASSES = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-full transition ${
      activeTab === t
        ? "bg-slate-900 text-white"
        : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <main className="max-w-2xl space-y-6">
      {/* Back + header */}
      <Link
        href="/hotels/manage"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
      >
        <ArrowLeft size={14} />
        My Hotels
      </Link>

      <div className="flex items-start justify-between gap-4">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Hotel Settings
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {hotel?.hotelTitle ?? "Edit Hotel"}
          </h1>
        </header>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex flex-shrink-0 items-center gap-2 rounded-full bg-sky-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-200 transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
        {(["info", "amenities", "policies"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={TAB_CLASSES(t)}
          >
            {t === "info" ? "Info" : t === "amenities" ? "Amenities" : "Policies"}
          </button>
        ))}
      </div>

      {/* ── Info Tab ── */}
      {activeTab === "info" && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Hotel Name
            </span>
            <input
              value={hotelTitle}
              onChange={(e) => setHotelTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Description
            </span>
            <textarea
              value={hotelDesc}
              onChange={(e) => setHotelDesc(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="Describe your property, unique features, nearby attractions…"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Star Rating
              </span>
              <select
                value={starRating}
                onChange={(e) => setStarRating(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {"★".repeat(n)} {n}-Star
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Check-in Time
              </span>
              <input
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Check-out Time
              </span>
              <input
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Image URLs{" "}
              <span className="font-normal normal-case text-slate-400">(one per line)</span>
            </span>
            <textarea
              value={hotelImages}
              onChange={(e) => setHotelImages(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs outline-none transition focus:border-slate-400"
            />
          </label>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Suitable For
            </p>
            <div className="flex flex-wrap gap-2">
              {SUITABLE_FOR_OPTIONS.map((val) => {
                const active = suitableFor.includes(val);
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => toggleSuitableFor(val)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "border-sky-400 bg-sky-50 text-sky-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {SUITABLE_LABELS[val] ?? val}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Amenities Tab ── */}
      {activeTab === "amenities" && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Facilities
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AMENITY_OPTIONS.map((opt) => {
                const active = Boolean(amenities[opt.key]);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => toggleAmenity(opt.key)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition ${
                      active
                        ? "border-sky-400 bg-sky-50 font-medium text-sky-800"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition ${
                        active ? "border-sky-500 bg-sky-500" : "border-slate-300"
                      }`}
                    >
                      {active && <Check size={10} className="text-white" strokeWidth={3} />}
                    </div>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Safety Features
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SAFETY_OPTIONS.map((opt) => {
                const active = Boolean(safetyFeatures[opt.key]);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => toggleSafety(opt.key)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition ${
                      active
                        ? "border-emerald-400 bg-emerald-50 font-medium text-emerald-800"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition ${
                        active ? "border-emerald-500 bg-emerald-500" : "border-slate-300"
                      }`}
                    >
                      {active && <Check size={10} className="text-white" strokeWidth={3} />}
                    </div>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Policies Tab ── */}
      {activeTab === "policies" && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cancellation Policy
            </p>
            <div className="space-y-2">
              {CANCELLATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCancellationPolicy(opt.value)}
                  className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                    cancellationPolicy === opt.value
                      ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                      cancellationPolicy === opt.value
                        ? "border-slate-900 bg-slate-900"
                        : "border-slate-300"
                    }`}
                  >
                    {cancellationPolicy === opt.value && (
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{opt.label}</p>
                    <p className="text-xs text-slate-500">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setPetsAllowed((v) => !v)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 transition ${
                petsAllowed ? "border-sky-300 bg-sky-50" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className="text-sm font-medium text-slate-800">Pets Allowed</span>
              <div
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition ${
                  petsAllowed ? "border-sky-500 bg-sky-500" : "border-slate-300"
                }`}
              >
                {petsAllowed && <Check size={11} className="text-white" strokeWidth={3} />}
              </div>
            </button>
            {petsAllowed && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Max Pet Weight (kg){" "}
                  <span className="font-normal normal-case text-slate-400">(optional)</span>
                </span>
                <input
                  type="number"
                  value={maxPetWeight}
                  onChange={(e) => setMaxPetWeight(e.target.value)}
                  className="w-32 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
                  placeholder="e.g. 10"
                />
              </label>
            )}

            <button
              type="button"
              onClick={() => setSmokingAllowed((v) => !v)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 transition ${
                smokingAllowed ? "border-sky-300 bg-sky-50" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className="text-sm font-medium text-slate-800">Smoking Allowed</span>
              <div
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition ${
                  smokingAllowed ? "border-sky-500 bg-sky-500" : "border-slate-300"
                }`}
              >
                {smokingAllowed && <Check size={11} className="text-white" strokeWidth={3} />}
              </div>
            </button>
          </div>

          {/* Flexible timing */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Flexible Timing Options
            </p>
            <div className="space-y-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Flexible Check-in</p>
                    <p className="text-xs text-slate-400">Allow guests to request early check-in</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFlexCheckInEnabled((v) => !v)}
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition ${
                      flexCheckInEnabled ? "border-sky-500 bg-sky-500" : "border-slate-300"
                    }`}
                  >
                    {flexCheckInEnabled && <Check size={11} className="text-white" strokeWidth={3} />}
                  </button>
                </div>
                {flexCheckInEnabled && (
                  <label className="mt-3 block">
                    <span className="mb-1 block text-xs text-slate-500">Surcharge (₩)</span>
                    <input
                      type="number"
                      value={flexCheckInFee}
                      onChange={(e) => setFlexCheckInFee(e.target.value)}
                      className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                      placeholder="30000"
                    />
                  </label>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Flexible Check-out</p>
                    <p className="text-xs text-slate-400">Allow guests to request late check-out</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFlexCheckOutEnabled((v) => !v)}
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition ${
                      flexCheckOutEnabled ? "border-sky-500 bg-sky-500" : "border-slate-300"
                    }`}
                  >
                    {flexCheckOutEnabled && <Check size={11} className="text-white" strokeWidth={3} />}
                  </button>
                </div>
                {flexCheckOutEnabled && (
                  <label className="mt-3 block">
                    <span className="mb-1 block text-xs text-slate-500">Surcharge (₩)</span>
                    <input
                      type="number"
                      value={flexCheckOutFee}
                      onChange={(e) => setFlexCheckOutFee(e.target.value)}
                      className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                      placeholder="30000"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom save (mobile convenience) */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <Link
          href={`/hotels/${hotelId}/rooms`}
          className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          Manage Rooms →
        </Link>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex items-center gap-2 rounded-full bg-sky-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sky-600 disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </main>
  );
};

EditHotelPage.auth = {
  roles: ["AGENT", "ADMIN", "ADMIN_OPERATOR"],
};

export default EditHotelPage;
