import { useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { HotelCard } from "@/components/hotels/hotel-card";
import { ErrorNotice } from "@/components/ui/error-notice";
import { GET_HOTELS_QUERY } from "@/graphql/hotel.gql";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  GetHotelsQueryData,
  GetHotelsQueryVars,
  HotelAmenityKey,
  HotelLocation,
  HotelSearchInput,
  HotelType,
  RoomType,
  StayPurpose,
} from "@/types/hotel";

const PAGE_SIZE = 12;

const HOTEL_LOCATIONS: HotelLocation[] = [
  "SEOUL",
  "BUSAN",
  "DAEGU",
  "DAEJON",
  "GWANGJU",
  "INCHEON",
  "JEJU",
  "GYEONGJU",
  "GANGNEUNG",
];

const HOTEL_TYPES: HotelType[] = ["HOTEL", "MOTEL", "RESORT", "GUESTHOUSE", "HANOK", "PENSION"];
const ROOM_TYPES: RoomType[] = ["STANDARD", "DELUXE", "SUITE", "FAMILY", "PREMIUM", "PENTHOUSE"];
const STAR_RATINGS = [1, 2, 3, 4, 5] as const;
const MIN_RATING_OPTIONS = [5, 4.5, 4, 3.5, 3, 2.5, 2] as const;

const STAY_PURPOSE_OPTIONS: Array<{ value: StayPurpose; label: string }> = [
  { value: "BUSINESS", label: "Business" },
  { value: "ROMANTIC", label: "Romantic" },
  { value: "FAMILY", label: "Family" },
  { value: "SOLO", label: "Solo" },
  { value: "STAYCATION", label: "Staycation" },
  { value: "EVENT", label: "Event" },
  { value: "MEDICAL", label: "Medical" },
  { value: "LONG_TERM", label: "Long-term" },
];

const AMENITY_OPTIONS: Array<{ key: HotelAmenityKey; label: string }> = [
  { key: "wifi", label: "Wi-Fi" },
  { key: "workspace", label: "Workspace" },
  { key: "meetingRoom", label: "Meeting room" },
  { key: "parking", label: "Parking" },
  { key: "breakfast", label: "Breakfast" },
  { key: "breakfastIncluded", label: "Breakfast included" },
  { key: "roomService", label: "Room service" },
  { key: "gym", label: "Gym" },
  { key: "pool", label: "Pool" },
  { key: "spa", label: "Spa" },
  { key: "restaurant", label: "Restaurant" },
  { key: "familyRoom", label: "Family room" },
  { key: "kidsFriendly", label: "Kids friendly" },
  { key: "playground", label: "Playground" },
  { key: "coupleRoom", label: "Couple room" },
  { key: "romanticView", label: "Romantic view" },
  { key: "privateBath", label: "Private bath" },
  { key: "airportShuttle", label: "Airport shuttle" },
  { key: "evCharging", label: "EV charging" },
  { key: "wheelchairAccessible", label: "Wheelchair accessible" },
  { key: "elevator", label: "Elevator" },
  { key: "accessibleBathroom", label: "Accessible bathroom" },
  { key: "visualAlarms", label: "Visual alarms" },
  { key: "serviceAnimalsAllowed", label: "Service animals allowed" },
];

const toSingle = (value: string | string[] | undefined): string => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0] ?? "";
  }

  return "";
};

const parseInteger = (value: string, minimum = 0): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    return undefined;
  }

  return parsed;
};

const parseRating = (value: string): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5) {
    return undefined;
  }

  return parsed;
};

const parseCsv = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const parseEnumCsv = <T extends string>(value: string, allowed: readonly T[]): T[] =>
  parseCsv(value).filter((item): item is T => allowed.includes(item as T));

const parseIntCsv = (value: string): number[] => {
  const unique = new Set<number>();
  parseCsv(value).forEach((item) => {
    const parsed = Number(item);
    if (Number.isInteger(parsed) && parsed > 0) {
      unique.add(parsed);
    }
  });
  return Array.from(unique);
};

const isIsoDateInput = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const toGraphQlDate = (value: string): string | undefined => {
  if (!isIsoDateInput(value)) {
    return undefined;
  }
  return `${value}T00:00:00.000Z`;
};

const toggleStringCsv = (current: string[], value: string, checked: boolean): string => {
  const next = new Set(current);
  if (checked) {
    next.add(value);
  } else {
    next.delete(value);
  }
  return Array.from(next).join(",");
};

const toggleNumberCsv = (current: number[], value: number, checked: boolean): string => {
  const next = new Set(current);
  if (checked) {
    next.add(value);
  } else {
    next.delete(value);
  }
  return Array.from(next)
    .sort((a, b) => a - b)
    .join(",");
};

export default function HotelsPage() {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const page = useMemo(() => {
    const parsed = parseInteger(toSingle(router.query.page), 1);
    return parsed ?? 1;
  }, [router.query.page]);

  const textInput = useMemo(() => toSingle(router.query.q), [router.query.q]);
  const selectedLocation = useMemo<HotelLocation | "">(() => {
    const raw = toSingle(router.query.location);
    return HOTEL_LOCATIONS.includes(raw as HotelLocation) ? (raw as HotelLocation) : "";
  }, [router.query.location]);

  const dongInput = useMemo(() => toSingle(router.query.dong), [router.query.dong]);
  const nearestSubwayInput = useMemo(() => toSingle(router.query.subway), [router.query.subway]);
  const subwayLinesInput = useMemo(() => toSingle(router.query.lines), [router.query.lines]);
  const maxWalkingDistanceInput = useMemo(() => toSingle(router.query.walk), [router.query.walk]);
  const selectedTypes = useMemo(() => parseEnumCsv(toSingle(router.query.types), HOTEL_TYPES), [router.query.types]);
  const selectedRoomTypes = useMemo(() => parseEnumCsv(toSingle(router.query.roomTypes), ROOM_TYPES), [router.query.roomTypes]);
  const selectedStarRatings = useMemo(() => {
    return parseIntCsv(toSingle(router.query.stars)).filter((star) => STAR_RATINGS.includes(star as (typeof STAR_RATINGS)[number]));
  }, [router.query.stars]);
  const selectedAmenities = useMemo(
    () => parseEnumCsv(toSingle(router.query.amenities), AMENITY_OPTIONS.map((option) => option.key)),
    [router.query.amenities],
  );
  const selectedPurpose = useMemo<StayPurpose | "">(() => {
    const raw = toSingle(router.query.purpose);
    return STAY_PURPOSE_OPTIONS.some((option) => option.value === raw) ? (raw as StayPurpose) : "";
  }, [router.query.purpose]);

  const minInput = useMemo(() => toSingle(router.query.min), [router.query.min]);
  const maxInput = useMemo(() => toSingle(router.query.max), [router.query.max]);
  const guestCountInput = useMemo(() => toSingle(router.query.guests), [router.query.guests]);
  const minRatingInput = useMemo(() => toSingle(router.query.minRating), [router.query.minRating]);
  const checkInInput = useMemo(() => toSingle(router.query.checkIn), [router.query.checkIn]);
  const checkOutInput = useMemo(() => toSingle(router.query.checkOut), [router.query.checkOut]);

  const verifiedOnly = useMemo(() => toSingle(router.query.verified) === "1", [router.query.verified]);
  const petsAllowed = useMemo(() => toSingle(router.query.pets) === "1", [router.query.pets]);
  const wheelchairAccessible = useMemo(() => toSingle(router.query.wheelchair) === "1", [router.query.wheelchair]);

  const minPrice = useMemo(() => parseInteger(minInput), [minInput]);
  const maxPrice = useMemo(() => parseInteger(maxInput), [maxInput]);
  const guestCount = useMemo(() => parseInteger(guestCountInput, 1), [guestCountInput]);
  const minRating = useMemo(() => parseRating(minRatingInput), [minRatingInput]);
  const maxWalkingDistance = useMemo(() => parseInteger(maxWalkingDistanceInput, 1), [maxWalkingDistanceInput]);
  const subwayLines = useMemo(() => parseIntCsv(subwayLinesInput), [subwayLinesInput]);

  const hasPriceRangeError = minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice;
  const hasDateRangeError =
    isIsoDateInput(checkInInput) &&
    isIsoDateInput(checkOutInput) &&
    new Date(`${checkInInput}T00:00:00.000Z`).getTime() >= new Date(`${checkOutInput}T00:00:00.000Z`).getTime();

  const search = useMemo<HotelSearchInput | undefined>(() => {
    const next: HotelSearchInput = {};
    const text = textInput.trim();
    const dong = dongInput.trim();
    const nearestSubway = nearestSubwayInput.trim();

    if (text) {
      next.text = text;
    }
    if (selectedLocation) {
      next.location = selectedLocation;
    }
    if (dong) {
      next.dong = dong;
    }
    if (nearestSubway) {
      next.nearestSubway = nearestSubway;
    }
    if (subwayLines.length > 0) {
      next.subwayLines = subwayLines;
    }
    if (maxWalkingDistance !== undefined) {
      next.maxWalkingDistance = maxWalkingDistance;
    }
    if (selectedTypes.length > 0) {
      next.hotelTypes = selectedTypes;
    }
    if (selectedRoomTypes.length > 0) {
      next.roomTypes = selectedRoomTypes;
    }
    if (selectedStarRatings.length > 0) {
      next.starRatings = selectedStarRatings;
    }
    if (minRating !== undefined && minRating > 0) {
      next.minRating = minRating;
    }
    if (selectedAmenities.length > 0) {
      next.amenities = selectedAmenities;
    }
    if (selectedPurpose) {
      next.purpose = selectedPurpose;
    }
    if (verifiedOnly) {
      next.verifiedOnly = true;
    }
    if (petsAllowed) {
      next.petsAllowed = true;
    }
    if (wheelchairAccessible) {
      next.wheelchairAccessible = true;
    }
    if (guestCount !== undefined) {
      next.guestCount = guestCount;
    }
    if (!hasDateRangeError) {
      const checkInDate = toGraphQlDate(checkInInput);
      const checkOutDate = toGraphQlDate(checkOutInput);
      if (checkInDate) {
        next.checkInDate = checkInDate;
      }
      if (checkOutDate) {
        next.checkOutDate = checkOutDate;
      }
    }
    if (!hasPriceRangeError && (minPrice !== undefined || maxPrice !== undefined)) {
      next.priceRange = {
        ...(minPrice !== undefined ? { start: minPrice } : {}),
        ...(maxPrice !== undefined ? { end: maxPrice } : {}),
      };
    }

    return Object.keys(next).length > 0 ? next : undefined;
  }, [
    checkInInput,
    checkOutInput,
    dongInput,
    guestCount,
    hasDateRangeError,
    hasPriceRangeError,
    maxPrice,
    maxWalkingDistance,
    minPrice,
    minRating,
    nearestSubwayInput,
    petsAllowed,
    selectedAmenities,
    selectedLocation,
    selectedPurpose,
    selectedRoomTypes,
    selectedStarRatings,
    selectedTypes,
    subwayLines,
    textInput,
    verifiedOnly,
    wheelchairAccessible,
  ]);

  const { data, loading, error } = useQuery<GetHotelsQueryData, GetHotelsQueryVars>(GET_HOTELS_QUERY, {
    variables: {
      input: {
        page,
        limit: PAGE_SIZE,
        sort: "createdAt",
        direction: -1,
      },
      search,
    },
    fetchPolicy: "cache-and-network",
  });

  const hotels = data?.getHotels.list ?? [];
  const total = data?.getHotels.metaCounter.total ?? 0;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const replaceQuery = (next: Record<string, string | undefined>, resetPage = true) => {
    const merged: Record<string, string> = {};

    Object.entries(router.query).forEach(([key, value]) => {
      const single = toSingle(value);
      if (single) {
        merged[key] = single;
      }
    });

    Object.entries(next).forEach(([key, value]) => {
      if (value) {
        merged[key] = value;
      } else {
        delete merged[key];
      }
    });

    if (resetPage) {
      merged.page = "1";
    }

    void router.replace(
      {
        pathname: router.pathname,
        query: merged,
      },
      undefined,
      { shallow: true, scroll: false },
    );
  };

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Discover</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Public Hotels</h1>
          <p className="mt-2 text-sm text-slate-600">Browse available stays across locations.</p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
        >
          Open dashboard
        </Link>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-700">Search</span>
            <input
              value={textInput}
              onChange={(event) => {
                replaceQuery({ q: event.target.value.trim() || undefined });
              }}
              placeholder="Hotel title or description"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 transition focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Location</span>
            <select
              value={selectedLocation}
              onChange={(event) => {
                replaceQuery({ location: event.target.value || undefined });
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 transition focus:ring-2"
            >
              <option value="">All locations</option>
              {HOTEL_LOCATIONS.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Purpose</span>
            <select
              value={selectedPurpose}
              onChange={(event) => {
                replaceQuery({ purpose: event.target.value || undefined });
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 transition focus:ring-2"
            >
              <option value="">Any purpose</option>
              {STAY_PURPOSE_OPTIONS.map((purpose) => (
                <option key={purpose.value} value={purpose.value}>
                  {purpose.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Dong</span>
            <input
              value={dongInput}
              onChange={(event) => {
                replaceQuery({ dong: event.target.value.trim() || undefined });
              }}
              placeholder="e.g. Yeoksam-dong"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 transition focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Nearest subway</span>
            <input
              value={nearestSubwayInput}
              onChange={(event) => {
                replaceQuery({ subway: event.target.value.trim() || undefined });
              }}
              placeholder="Gangnam Station"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 transition focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Subway lines (comma)</span>
            <input
              value={subwayLinesInput}
              onChange={(event) => {
                const normalized = event.target.value.replace(/[^\d,\s]/g, "");
                replaceQuery({ lines: normalized.trim() || undefined });
              }}
              placeholder="2,9"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 transition focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Max walk (minutes)</span>
            <input
              value={maxWalkingDistanceInput}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, "");
                replaceQuery({ walk: digits || undefined });
              }}
              inputMode="numeric"
              placeholder="15"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 transition focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Min price (KRW)</span>
            <input
              value={minInput}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, "");
                replaceQuery({ min: digits || undefined });
              }}
              inputMode="numeric"
              placeholder="0"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 transition focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Max price (KRW)</span>
            <input
              value={maxInput}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, "");
                replaceQuery({ max: digits || undefined });
              }}
              inputMode="numeric"
              placeholder="500000"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 transition focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Guests</span>
            <input
              value={guestCountInput}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, "");
                replaceQuery({ guests: digits || undefined });
              }}
              inputMode="numeric"
              placeholder="2"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 transition focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Min rating</span>
            <select
              value={minRatingInput}
              onChange={(event) => {
                replaceQuery({ minRating: event.target.value || undefined });
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 transition focus:ring-2"
            >
              <option value="">Any rating</option>
              {MIN_RATING_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value.toFixed(1)}+
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Check-in</span>
            <input
              type="date"
              value={checkInInput}
              onChange={(event) => {
                replaceQuery({ checkIn: event.target.value || undefined });
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 transition focus:ring-2"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Check-out</span>
            <input
              type="date"
              value={checkOutInput}
              onChange={(event) => {
                replaceQuery({ checkOut: event.target.value || undefined });
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-900 transition focus:ring-2"
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                void router.replace(
                  {
                    pathname: router.pathname,
                    query: {},
                  },
                  undefined,
                  { shallow: true, scroll: false },
                );
              }}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
            >
              Reset filters
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(event) => {
                replaceQuery({ verified: event.target.checked ? "1" : undefined });
              }}
              className="h-4 w-4"
            />
            Verified only
          </label>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={petsAllowed}
              onChange={(event) => {
                replaceQuery({ pets: event.target.checked ? "1" : undefined });
              }}
              className="h-4 w-4"
            />
            Pets allowed
          </label>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={wheelchairAccessible}
              onChange={(event) => {
                replaceQuery({ wheelchair: event.target.checked ? "1" : undefined });
              }}
              className="h-4 w-4"
            />
            Wheelchair accessible
          </label>
        </div>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-slate-700">Hotel types</legend>
          <div className="flex flex-wrap gap-2">
            {HOTEL_TYPES.map((type) => {
              const checked = selectedTypes.includes(type);

              return (
                <label key={type} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const encoded = toggleStringCsv(selectedTypes, type, event.target.checked);
                      replaceQuery({ types: encoded || undefined });
                    }}
                    className="h-4 w-4"
                  />
                  <span>{type}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-slate-700">Room types</legend>
          <div className="flex flex-wrap gap-2">
            {ROOM_TYPES.map((type) => {
              const checked = selectedRoomTypes.includes(type);

              return (
                <label key={type} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const encoded = toggleStringCsv(selectedRoomTypes, type, event.target.checked);
                      replaceQuery({ roomTypes: encoded || undefined });
                    }}
                    className="h-4 w-4"
                  />
                  <span>{type}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-slate-700">Star ratings</legend>
          <div className="flex flex-wrap gap-2">
            {STAR_RATINGS.map((star) => {
              const checked = selectedStarRatings.includes(star);

              return (
                <label key={star} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const encoded = toggleNumberCsv(selectedStarRatings, star, event.target.checked);
                      replaceQuery({ stars: encoded || undefined });
                    }}
                    className="h-4 w-4"
                  />
                  <span>{star} star</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-slate-700">Amenities</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {AMENITY_OPTIONS.map((amenity) => {
              const checked = selectedAmenities.includes(amenity.key);

              return (
                <label key={amenity.key} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const encoded = toggleStringCsv(selectedAmenities, amenity.key, event.target.checked);
                      replaceQuery({ amenities: encoded || undefined });
                    }}
                    className="h-4 w-4"
                  />
                  <span>{amenity.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {hasPriceRangeError ? (
          <ErrorNotice
            className="mt-3"
            tone="warn"
            message="Min price must be less than or equal to max price."
          />
        ) : null}
        {hasDateRangeError ? (
          <ErrorNotice
            className="mt-3"
            tone="warn"
            message="Check-out must be after check-in."
          />
        ) : null}
      </section>

      {error ? <ErrorNotice message={getErrorMessage(error)} /> : null}

      {!isHydrated ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">Loading hotels...</div>
      ) : null}

      {isHydrated && loading && hotels.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">Loading hotels...</div>
      ) : null}

      {isHydrated && !loading && hotels.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No hotels found for current filters.
        </div>
      ) : null}

      {isHydrated && hotels.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hotels.map((hotel) => (
              <HotelCard key={hotel._id} hotel={hotel} />
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-sm text-slate-600">
              Page {page} of {totalPages} · {total} hotels
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  replaceQuery({ page: String(Math.max(1, page - 1)) }, false);
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => {
                  replaceQuery({ page: String(Math.min(totalPages, page + 1)) }, false);
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
