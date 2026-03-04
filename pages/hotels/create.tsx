import { useMutation } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { CREATE_HOTEL_MUTATION } from "@/graphql/hotel.gql";
import { getErrorMessage } from "@/lib/utils/error";
import { successAlert } from "@/lib/ui/alerts";
import type {
  AmenitiesInput,
  CancellationPolicy,
  CreateHotelMutationData,
  CreateHotelMutationVars,
  HotelLocation,
  HotelType,
} from "@/types/hotel";
import type { NextPageWithAuth } from "@/types/page";
import { ArrowLeft, Check, ChevronDown } from "lucide-react";

// ─── Config ───────────────────────────────────────────────────────────────────

const HOTEL_TYPES: Array<{ value: HotelType; label: string }> = [
  { value: "HOTEL",      label: "Hotel" },
  { value: "MOTEL",      label: "Motel" },
  { value: "RESORT",     label: "Resort" },
  { value: "GUESTHOUSE", label: "Guesthouse" },
  { value: "HANOK",      label: "Hanok (Traditional)" },
  { value: "PENSION",    label: "Pension" },
];

const LOCATIONS: Array<{ value: HotelLocation; label: string }> = [
  { value: "SEOUL",     label: "Seoul" },
  { value: "BUSAN",     label: "Busan" },
  { value: "INCHEON",   label: "Incheon" },
  { value: "DAEGU",     label: "Daegu" },
  { value: "DAEJON",    label: "Daejeon" },
  { value: "GWANGJU",   label: "Gwangju" },
  { value: "JEJU",      label: "Jeju" },
  { value: "GYEONGJU",  label: "Gyeongju" },
  { value: "GANGNEUNG", label: "Gangneung" },
];

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

// ─── Page ─────────────────────────────────────────────────────────────────────

const CreateHotelPage: NextPageWithAuth = () => {
  const router = useRouter();

  // Basic info
  const [hotelTitle, setHotelTitle]     = useState("");
  const [hotelType, setHotelType]       = useState<HotelType>("HOTEL");
  const [hotelLocation, setHotelLocation] = useState<HotelLocation>("SEOUL");
  const [address, setAddress]           = useState("");
  const [lat, setLat]                   = useState("");
  const [lng, setLng]                   = useState("");
  const [hotelDesc, setHotelDesc]       = useState("");
  const [starRating, setStarRating]     = useState(3);
  const [checkInTime, setCheckInTime]   = useState("15:00");
  const [checkOutTime, setCheckOutTime] = useState("11:00");
  const [hotelImages, setHotelImages]   = useState("");

  // Policies
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicy>("MODERATE");
  const [petsAllowed, setPetsAllowed]       = useState(false);
  const [smokingAllowed, setSmokingAllowed] = useState(false);

  // Amenities
  const [amenities, setAmenities] = useState<AmenitiesInput>({});

  // UI
  const [openSection, setOpenSection] = useState<1 | 2 | 3>(1);
  const [formError, setFormError]     = useState<string | null>(null);
  const [created, setCreated]         = useState<{ id: string; title: string } | null>(null);

  const [createHotel, { loading }] = useMutation<
    CreateHotelMutationData,
    CreateHotelMutationVars
  >(CREATE_HOTEL_MUTATION);

  const toggleAmenity = (key: keyof AmenitiesInput) => {
    setAmenities((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!hotelTitle.trim()) { setFormError("Hotel name is required."); return; }
    if (!address.trim())    { setFormError("Address is required."); return; }
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      setFormError("Valid GPS coordinates (Lat and Lng) are required.");
      return;
    }

    const imageUrls = hotelImages
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);

    try {
      const result = await createHotel({
        variables: {
          input: {
            hotelType,
            hotelTitle: hotelTitle.trim(),
            hotelLocation,
            detailedLocation: {
              city: hotelLocation,
              address: address.trim(),
              coordinates: { lat: latNum, lng: lngNum },
            },
            hotelDesc: hotelDesc.trim() || undefined,
            starRating,
            checkInTime,
            checkOutTime,
            cancellationPolicy,
            petsAllowed,
            smokingAllowed,
            amenities: Object.keys(amenities).length > 0 ? amenities : undefined,
            hotelImages: imageUrls.length > 0 ? imageUrls : undefined,
          },
        },
      });

      const hotel = result.data?.createHotel;
      if (hotel) {
        setCreated({ id: hotel._id, title: hotel.hotelTitle });
        successAlert("Hotel registered! It will be reviewed by an admin before going live.");
      }
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  };

  // ── Success screen ──
  if (created) {
    return (
      <>
        <style>{`
          @keyframes hotelConfirm {
            0%   { transform: scale(0.8); opacity: 0; }
            60%  { transform: scale(1.05); }
            100% { transform: scale(1); opacity: 1; }
          }
          .anim-confirm { animation: hotelConfirm 0.45s cubic-bezier(0.34,1.56,0.64,1) both; }
          @keyframes confirmFade {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .anim-cfade { animation: confirmFade 0.4s ease-out 0.3s both; }
        `}</style>
        <main className="mx-auto max-w-lg space-y-6 py-8 text-center">
          <div className="anim-confirm mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-200">
            <Check size={36} strokeWidth={2.5} />
          </div>
          <div className="anim-cfade space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
              Hotel Registered
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">{created.title}</h1>
          </div>
          <div className="anim-cfade rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            Your hotel is currently <strong>under admin review</strong>. It will go live once
            approved. In the meantime, you can add rooms.
          </div>
          <div className="anim-cfade flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href={`/hotels/${created.id}/rooms`}
              className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Add Rooms →
            </Link>
            <Link
              href="/hotels/manage"
              className="rounded-full border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
            >
              My Hotels
            </Link>
          </div>
        </main>
      </>
    );
  }

  // ── Section header ──
  const SectionHeader = ({
    num,
    label,
    isOpen,
  }: {
    num: 1 | 2 | 3;
    label: string;
    isOpen: boolean;
  }) => (
    <button
      type="button"
      onClick={() => setOpenSection(num)}
      className="flex w-full items-center justify-between px-5 py-4 text-left"
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            isOpen ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          {num}
        </div>
        <span className={`font-semibold ${isOpen ? "text-slate-900" : "text-slate-500"}`}>
          {label}
        </span>
      </div>
      <ChevronDown
        size={16}
        className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
      />
    </button>
  );

  return (
    <>
      <style>{`
        @keyframes sectionOpen {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .section-body { animation: sectionOpen 0.18s ease-out; }
      `}</style>

      <main className="space-y-6">
        {/* Back + header */}
        <Link
          href="/hotels/manage"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft size={14} />
          My Hotels
        </Link>

        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Property Registration
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Register a Hotel
          </h1>
        </header>

        {formError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {formError}
          </div>
        )}

        <div className="max-w-2xl space-y-3">
          {/* ── Section 1: Basic Info ── */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader num={1} label="Basic Information" isOpen={openSection === 1} />
            {openSection === 1 && (
              <div className="section-body space-y-4 border-t border-slate-100 px-5 pb-5 pt-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Hotel Name <span className="text-rose-500">*</span>
                  </span>
                  <input
                    value={hotelTitle}
                    onChange={(e) => setHotelTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    placeholder="e.g. Grand Seoul Hotel"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Type
                    </span>
                    <select
                      value={hotelType}
                      onChange={(e) => setHotelType(e.target.value as HotelType)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    >
                      {HOTEL_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      City
                    </span>
                    <select
                      value={hotelLocation}
                      onChange={(e) => setHotelLocation(e.target.value as HotelLocation)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    >
                      {LOCATIONS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Address <span className="text-rose-500">*</span>
                  </span>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    placeholder="Full street address"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Latitude <span className="text-rose-500">*</span>
                    </span>
                    <input
                      type="number"
                      step="any"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                      placeholder="37.5665"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Longitude <span className="text-rose-500">*</span>
                    </span>
                    <input
                      type="number"
                      step="any"
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                      placeholder="126.9780"
                    />
                  </label>
                </div>
                <p className="text-xs text-slate-400">
                  Find coordinates at{" "}
                  <span className="font-medium">maps.google.com</span> → right-click on your location.
                </p>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Description{" "}
                    <span className="font-normal normal-case text-slate-400">(optional)</span>
                  </span>
                  <textarea
                    value={hotelDesc}
                    onChange={(e) => setHotelDesc(e.target.value)}
                    rows={3}
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
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
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
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
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
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Image URLs{" "}
                    <span className="font-normal normal-case text-slate-400">
                      (one per line, optional)
                    </span>
                  </span>
                  <textarea
                    value={hotelImages}
                    onChange={(e) => setHotelImages(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    placeholder="https://example.com/photo1.jpg&#10;https://example.com/photo2.jpg"
                  />
                </label>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setOpenSection(2)}
                    className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                  >
                    Next: Policies →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 2: Policies ── */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader num={2} label="Policies" isOpen={openSection === 2} />
            {openSection === 2 && (
              <div className="section-body space-y-5 border-t border-slate-100 px-5 pb-5 pt-4">
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
                          <p className="text-sm font-semibold text-slate-800">
                            {opt.label}
                          </p>
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

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setOpenSection(1)}
                    className="rounded-full border border-slate-200 px-5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenSection(3)}
                    className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                  >
                    Next: Amenities →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 3: Amenities ── */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader num={3} label="Amenities" isOpen={openSection === 3} />
            {openSection === 3 && (
              <div className="section-body space-y-4 border-t border-slate-100 px-5 pb-5 pt-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {AMENITY_OPTIONS.map((opt) => {
                    const active = Boolean(amenities[opt.key]);
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => toggleAmenity(opt.key)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                          active
                            ? "border-sky-400 bg-sky-50 text-sky-800"
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
                        <span className="text-xs font-medium leading-tight">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setOpenSection(2)}
                    className="rounded-full border border-slate-200 px-5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={loading}
                    className="rounded-full bg-sky-500 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-200 transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? "Registering…" : "Register Hotel"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
};

CreateHotelPage.auth = {
  roles: ["AGENT", "ADMIN"],
};

export default CreateHotelPage;
