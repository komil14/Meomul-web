import { useQuery } from "@apollo/client/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo } from "react";
import { HotelCard } from "@/components/hotels/hotel-card";
import { GET_HOTELS_QUERY } from "@/graphql/hotel.gql";
import { getErrorMessage } from "@/lib/utils/error";
import type {
  GetHotelsQueryData,
  GetHotelsQueryVars,
  HotelLocation,
  HotelSearchInput,
  HotelType,
} from "@/types/hotel";

const PAGE_SIZE = 12;

const HOTEL_LOCATIONS: HotelLocation[] = [
  "SEOUL",
  "BUSAN",
  "DAEGU",
  "DAEJEON",
  "GWANGJU",
  "INCHEON",
  "JEJU",
  "GYEONGJU",
  "GANGNEUNG",
];

const HOTEL_TYPES: HotelType[] = ["HOTEL", "MOTEL", "RESORT", "GUESTHOUSE", "HANOK", "PENSION"];

const toSingle = (value: string | string[] | undefined): string => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0] ?? "";
  }

  return "";
};

const parsePositiveInt = (value: string): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
};

export default function HotelsPage() {
  const router = useRouter();

  const page = useMemo(() => {
    const parsed = Number(toSingle(router.query.page));
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }

    return 1;
  }, [router.query.page]);

  const selectedLocation = useMemo(() => {
    const raw = toSingle(router.query.location);
    if (HOTEL_LOCATIONS.includes(raw as HotelLocation)) {
      return raw as HotelLocation;
    }

    return "";
  }, [router.query.location]);

  const selectedTypes = useMemo(() => {
    const raw = toSingle(router.query.types);
    if (!raw) {
      return [] as HotelType[];
    }

    return raw
      .split(",")
      .map((type) => type.trim())
      .filter((type): type is HotelType => HOTEL_TYPES.includes(type as HotelType));
  }, [router.query.types]);

  const minInput = useMemo(() => toSingle(router.query.min), [router.query.min]);
  const maxInput = useMemo(() => toSingle(router.query.max), [router.query.max]);

  const minPrice = useMemo(() => parsePositiveInt(minInput), [minInput]);
  const maxPrice = useMemo(() => parsePositiveInt(maxInput), [maxInput]);
  const hasPriceRangeError = minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice;

  const search = useMemo<HotelSearchInput | undefined>(() => {
    const next: HotelSearchInput = {};

    if (selectedLocation) {
      next.location = selectedLocation;
    }

    if (selectedTypes.length > 0) {
      next.hotelTypes = selectedTypes;
    }

    if (!hasPriceRangeError && (minPrice !== undefined || maxPrice !== undefined)) {
      next.priceRange = {
        ...(minPrice !== undefined ? { start: minPrice } : {}),
        ...(maxPrice !== undefined ? { end: maxPrice } : {}),
      };
    }

    return Object.keys(next).length > 0 ? next : undefined;
  }, [hasPriceRangeError, maxPrice, minPrice, selectedLocation, selectedTypes]);

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

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                replaceQuery({ location: undefined, types: undefined, min: undefined, max: undefined, page: undefined });
              }}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
            >
              Reset filters
            </button>
          </div>
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
                      const next = new Set(selectedTypes);

                      if (event.target.checked) {
                        next.add(type);
                      } else {
                        next.delete(type);
                      }

                      const encoded = Array.from(next).join(",");
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

        {hasPriceRangeError ? <p className="mt-3 text-sm text-red-600">Min price must be less than or equal to max price.</p> : null}
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error)}
        </div>
      ) : null}

      {loading && hotels.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">Loading hotels...</div>
      ) : null}

      {!loading && hotels.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No hotels found for current filters.
        </div>
      ) : null}

      {hotels.length > 0 ? (
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
