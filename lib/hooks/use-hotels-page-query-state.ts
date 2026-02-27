import { useRouter } from "next/router";
import { useCallback, useMemo } from "react";
import {
  AMENITY_OPTIONS,
  HOTEL_LOCATIONS,
  HOTEL_TYPES,
  ROOM_TYPES,
  STAR_RATINGS,
  STAY_PURPOSE_OPTIONS,
} from "@/lib/hotels/hotels-filter-config";
import type { HotelAmenityKey, HotelLocation, HotelSearchInput, HotelType, RoomType, StayPurpose } from "@/types/hotel";

type QueryPatch = Record<string, string | undefined>;

const AMENITY_KEYS = AMENITY_OPTIONS.map((option) => option.key);

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

export interface HotelsPageQueryState {
  page: number;
  textInput: string;
  selectedLocation: HotelLocation | "";
  dongInput: string;
  nearestSubwayInput: string;
  subwayLinesInput: string;
  maxWalkingDistanceInput: string;
  selectedTypes: HotelType[];
  selectedRoomTypes: RoomType[];
  selectedStarRatings: number[];
  selectedAmenities: HotelAmenityKey[];
  selectedPurpose: StayPurpose | "";
  minInput: string;
  maxInput: string;
  guestCountInput: string;
  minRatingInput: string;
  checkInInput: string;
  checkOutInput: string;
  verifiedOnly: boolean;
  petsAllowed: boolean;
  wheelchairAccessible: boolean;
  hasPriceRangeError: boolean;
  hasDateRangeError: boolean;
  search?: HotelSearchInput;
  patchQuery: (next: QueryPatch, resetPage?: boolean) => void;
  clearQuery: () => void;
}

export const useHotelsPageQueryState = (): HotelsPageQueryState => {
  const router = useRouter();

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
  const selectedStarRatings = useMemo(
    () => parseIntCsv(toSingle(router.query.stars)).filter((star) => STAR_RATINGS.includes(star as (typeof STAR_RATINGS)[number])),
    [router.query.stars],
  );
  const selectedAmenities = useMemo(() => parseEnumCsv(toSingle(router.query.amenities), AMENITY_KEYS), [router.query.amenities]);
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

  const patchQuery = useCallback(
    (next: QueryPatch, resetPage = true) => {
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
    },
    [router],
  );

  const clearQuery = useCallback(() => {
    void router.replace(
      {
        pathname: router.pathname,
        query: {},
      },
      undefined,
      { shallow: true, scroll: false },
    );
  }, [router]);

  return {
    page,
    textInput,
    selectedLocation,
    dongInput,
    nearestSubwayInput,
    subwayLinesInput,
    maxWalkingDistanceInput,
    selectedTypes,
    selectedRoomTypes,
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
    search,
    patchQuery,
    clearQuery,
  };
};
