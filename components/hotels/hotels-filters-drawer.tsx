import { useCallback, useEffect, useMemo, useState } from "react";
import { HotelsFiltersPanel } from "@/components/hotels/hotels-filters-panel";
import {
  AMENITY_OPTIONS,
  HOTEL_LOCATIONS,
  HOTEL_TYPES,
  ROOM_TYPES,
  STAR_RATINGS,
  STAY_PURPOSE_OPTIONS,
} from "@/lib/hotels/hotels-filter-config";
import type { HotelsPageQueryState } from "@/lib/hooks/use-hotels-page-query-state";
import type { HotelAmenityKey, HotelLocation, HotelType, RoomType, StayPurpose } from "@/types/hotel";

interface HotelsFiltersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  state: HotelsPageQueryState;
}

type FilterQueryKey =
  | "q"
  | "location"
  | "purpose"
  | "dong"
  | "subway"
  | "lines"
  | "walk"
  | "min"
  | "max"
  | "guests"
  | "minRating"
  | "checkIn"
  | "checkOut"
  | "verified"
  | "pets"
  | "wheelchair"
  | "types"
  | "roomTypes"
  | "stars"
  | "amenities";

type DraftQuery = Partial<Record<FilterQueryKey, string>>;

const FILTER_QUERY_KEYS: FilterQueryKey[] = [
  "q",
  "location",
  "purpose",
  "dong",
  "subway",
  "lines",
  "walk",
  "min",
  "max",
  "guests",
  "minRating",
  "checkIn",
  "checkOut",
  "verified",
  "pets",
  "wheelchair",
  "types",
  "roomTypes",
  "stars",
  "amenities",
];

const AMENITY_KEYS = AMENITY_OPTIONS.map((option) => option.key);

const isIsoDateInput = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const parseCsv = (value?: string): string[] =>
  value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const parseEnumCsv = <T extends string>(value: string | undefined, allowed: readonly T[]): T[] =>
  parseCsv(value).filter((item): item is T => allowed.includes(item as T));

const parseIntCsv = (value?: string): number[] => {
  const unique = new Set<number>();
  parseCsv(value).forEach((item) => {
    const parsed = Number(item);
    if (Number.isInteger(parsed) && parsed > 0) {
      unique.add(parsed);
    }
  });
  return Array.from(unique);
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

const toCsv = (values: readonly (string | number)[]): string | undefined => (values.length > 0 ? values.join(",") : undefined);

const toFlag = (value: boolean): string | undefined => (value ? "1" : undefined);

const buildApplyPatch = (draft: DraftQuery): Record<string, string | undefined> => {
  const patch: Record<string, string | undefined> = {};
  FILTER_QUERY_KEYS.forEach((key) => {
    patch[key] = draft[key];
  });
  return patch;
};

export function HotelsFiltersDrawer({ isOpen, onClose, state }: HotelsFiltersDrawerProps) {
  const sourceDraft = useMemo(
    () => ({
      q: state.textInput.trim() || undefined,
      location: state.selectedLocation || undefined,
      purpose: state.selectedPurpose || undefined,
      dong: state.dongInput.trim() || undefined,
      subway: state.nearestSubwayInput.trim() || undefined,
      lines: state.subwayLinesInput.trim() || undefined,
      walk: state.maxWalkingDistanceInput || undefined,
      min: state.minInput || undefined,
      max: state.maxInput || undefined,
      guests: state.guestCountInput || undefined,
      minRating: state.minRatingInput || undefined,
      checkIn: state.checkInInput || undefined,
      checkOut: state.checkOutInput || undefined,
      verified: toFlag(state.verifiedOnly),
      pets: toFlag(state.petsAllowed),
      wheelchair: toFlag(state.wheelchairAccessible),
      types: toCsv(state.selectedTypes),
      roomTypes: toCsv(state.selectedRoomTypes),
      stars: toCsv(state.selectedStarRatings),
      amenities: toCsv(state.selectedAmenities),
    }),
    [
      state.checkInInput,
      state.checkOutInput,
      state.dongInput,
      state.guestCountInput,
      state.maxInput,
      state.maxWalkingDistanceInput,
      state.minInput,
      state.minRatingInput,
      state.nearestSubwayInput,
      state.petsAllowed,
      state.selectedAmenities,
      state.selectedLocation,
      state.selectedPurpose,
      state.selectedRoomTypes,
      state.selectedStarRatings,
      state.selectedTypes,
      state.subwayLinesInput,
      state.textInput,
      state.verifiedOnly,
      state.wheelchairAccessible,
    ],
  );
  const [draft, setDraft] = useState<DraftQuery>(sourceDraft);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setDraft(sourceDraft);
  }, [isOpen, sourceDraft]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  const patchDraftQuery = useCallback((next: Record<string, string | undefined>) => {
    setDraft((previous) => {
      const merged: DraftQuery = { ...previous };
      Object.entries(next).forEach(([rawKey, value]) => {
        const key = rawKey as FilterQueryKey;
        if (FILTER_QUERY_KEYS.includes(key)) {
          if (value) {
            merged[key] = value;
          } else {
            delete merged[key];
          }
        }
      });
      return merged;
    });
  }, []);

  const clearDraftQuery = useCallback(() => {
    setDraft({});
  }, []);

  const textInput = draft.q ?? "";
  const selectedLocation = HOTEL_LOCATIONS.includes((draft.location ?? "") as HotelLocation) ? ((draft.location ?? "") as HotelLocation) : "";
  const selectedPurpose = STAY_PURPOSE_OPTIONS.some((option) => option.value === draft.purpose)
    ? (draft.purpose as StayPurpose)
    : "";
  const dongInput = draft.dong ?? "";
  const nearestSubwayInput = draft.subway ?? "";
  const subwayLinesInput = draft.lines ?? "";
  const maxWalkingDistanceInput = draft.walk ?? "";
  const selectedTypes = parseEnumCsv(draft.types, HOTEL_TYPES);
  const selectedRoomTypes = parseEnumCsv(draft.roomTypes, ROOM_TYPES);
  const selectedStarRatings = parseIntCsv(draft.stars).filter((star) => STAR_RATINGS.includes(star as (typeof STAR_RATINGS)[number]));
  const selectedAmenities = parseEnumCsv(draft.amenities, AMENITY_KEYS) as HotelAmenityKey[];
  const minInput = draft.min ?? "";
  const maxInput = draft.max ?? "";
  const guestCountInput = draft.guests ?? "";
  const minRatingInput = draft.minRating ?? "";
  const checkInInput = draft.checkIn ?? "";
  const checkOutInput = draft.checkOut ?? "";
  const verifiedOnly = draft.verified === "1";
  const petsAllowed = draft.pets === "1";
  const wheelchairAccessible = draft.wheelchair === "1";

  const minPrice = parseInteger(minInput);
  const maxPrice = parseInteger(maxInput);
  const hasPriceRangeError = minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice;
  const hasDateRangeError =
    isIsoDateInput(checkInInput) &&
    isIsoDateInput(checkOutInput) &&
    new Date(`${checkInInput}T00:00:00.000Z`).getTime() >= new Date(`${checkOutInput}T00:00:00.000Z`).getTime();

  const draftPanelState: HotelsPageQueryState = useMemo(
    () => ({
      ...state,
      textInput,
      selectedLocation,
      dongInput,
      nearestSubwayInput,
      subwayLinesInput,
      maxWalkingDistanceInput,
      selectedTypes: selectedTypes as HotelType[],
      selectedRoomTypes: selectedRoomTypes as RoomType[],
      selectedStarRatings,
      selectedAmenities,
      selectedPurpose,
      minInput,
      maxInput,
      guestCountInput,
      minRatingInput,
      checkInInput,
      checkOutInput,
      verifiedOnly,
      petsAllowed,
      wheelchairAccessible,
      hasPriceRangeError,
      hasDateRangeError,
      patchQuery: patchDraftQuery,
      clearQuery: clearDraftQuery,
    }),
    [
      checkInInput,
      checkOutInput,
      clearDraftQuery,
      dongInput,
      guestCountInput,
      hasDateRangeError,
      hasPriceRangeError,
      maxInput,
      maxWalkingDistanceInput,
      minInput,
      minRatingInput,
      nearestSubwayInput,
      patchDraftQuery,
      petsAllowed,
      selectedAmenities,
      selectedLocation,
      selectedPurpose,
      selectedRoomTypes,
      selectedStarRatings,
      selectedTypes,
      state,
      subwayLinesInput,
      textInput,
      verifiedOnly,
      wheelchairAccessible,
    ],
  );

  const applyDraftFilters = useCallback(() => {
    state.patchQuery(buildApplyPatch(draft));
    onClose();
  }, [draft, onClose, state]);

  const hasDraftValidationError = hasPriceRangeError || hasDateRangeError;

  return (
    <div className={`fixed inset-0 z-[80] ${isOpen ? "" : "pointer-events-none"}`}>
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/45 transition duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
      />

      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-[#f6f9fd] p-2 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] shadow-2xl transition-transform duration-300 sm:p-4 sm:pb-[calc(env(safe-area-inset-bottom)+0.75rem)] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!isOpen}
      >
        <div className="sticky top-0 z-10 mb-2 rounded-2xl border border-slate-200 bg-white/95 p-2.5 backdrop-blur sm:mb-3 sm:p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Advanced filters</p>
              <p className="mt-1 text-sm text-slate-600">Everything supported by backend search.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-slate-500"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <HotelsFiltersPanel state={draftPanelState} />

        <div className="sticky bottom-0 mt-3 border-t border-slate-200 bg-[#f6f9fd]/95 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2.5 backdrop-blur sm:pt-3">
          <button
            type="button"
            onClick={applyDraftFilters}
            disabled={hasDraftValidationError}
            className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Show Results
          </button>
        </div>
      </aside>
    </div>
  );
}
