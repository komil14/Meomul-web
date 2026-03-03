import { useMutation, useQuery } from "@apollo/client/react";
import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ErrorNotice } from "@/components/ui/error-notice";
import { useToast } from "@/components/ui/toast-provider";
import { GET_MY_LIKES_QUERY } from "@/graphql/like.gql";
import {
  GET_HOTEL_CARD_QUERY,
  TOGGLE_LIKE_MUTATION,
} from "@/graphql/hotel.gql";
import { getSessionMember } from "@/lib/auth/session";
import { getErrorMessage } from "@/lib/utils/error";
import { Heart } from "lucide-react";
import type { HotelListItem } from "@/types/hotel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LikeDto {
  _id: string;
  likeRefId: string;
  likeGroup: string;
  createdAt: string;
}

interface GetMyLikesData {
  getMyLikes: LikeDto[];
}

interface GetHotelCardData {
  getHotel: HotelListItem;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatLocation = (loc: string) =>
  loc ? loc.charAt(0).toUpperCase() + loc.slice(1).toLowerCase() : "";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ─── LikedHotelItem ───────────────────────────────────────────────────────────

function LikedHotelItem({
  hotelId,
  likedAt,
  onUnliked,
}: {
  hotelId: string;
  likedAt: string;
  onUnliked: (hotelId: string) => void;
}) {
  const toast = useToast();
  const { data, loading } = useQuery<GetHotelCardData>(GET_HOTEL_CARD_QUERY, {
    variables: { hotelId },
    fetchPolicy: "cache-first",
  });

  const [toggleLike, { loading: unliking }] = useMutation(TOGGLE_LIKE_MUTATION);

  const hotel = data?.getHotel;
  const coverImage = hotel?.hotelImages[0];

  const handleUnlike = async () => {
    try {
      await toggleLike({
        variables: { input: { likeGroup: "HOTEL", likeRefId: hotelId } },
      });
      onUnliked(hotelId);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_22px_46px_-34px_rgba(15,23,42,0.55)]">
        <div className="h-56 animate-pulse bg-slate-100 sm:h-64" />
        <div className="space-y-2 p-4">
          <div className="h-4 w-3/4 animate-pulse rounded-full bg-slate-100" />
          <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-50" />
        </div>
      </div>
    );
  }

  if (!hotel) return null;

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_22px_46px_-34px_rgba(15,23,42,0.55)] transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_30px_66px_-30px_rgba(15,23,42,0.58)]">
      <Link href={`/hotels/${hotel._id}`} className="block focus:outline-none">
        <div className="relative h-56 w-full overflow-hidden bg-slate-200 sm:h-64">
          {coverImage ? (
            <Image
              src={coverImage}
              alt={hotel.hotelTitle}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-200 via-slate-100 to-white text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
              curated stay
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <p className="line-clamp-2 text-base font-semibold leading-tight text-white">
              {hotel.hotelTitle}
            </p>
            <p className="mt-1 text-xs text-white/80">
              {formatLocation(hotel.hotelLocation)} · {hotel.hotelType}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-3.5 w-3.5 text-amber-400"
              aria-hidden
            >
              <path d="M12 2l2.95 6.08 6.72.98-4.86 4.67 1.15 6.6L12 17.2l-5.96 3.13 1.15-6.6L2.33 9.06l6.72-.98L12 2z" />
            </svg>
            <span className="font-medium text-slate-600">
              {hotel.hotelRating.toFixed(1)}
            </span>
            <span>·</span>
            <span>{hotel.hotelLikes.toLocaleString()} likes</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Saved {timeAgo(likedAt)}
          </span>
        </div>
      </Link>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          void handleUnlike();
        }}
        disabled={unliking}
        aria-label="Remove from saved"
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur-sm transition hover:bg-white hover:scale-110 disabled:opacity-60"
      >
        <Heart size={16} className="fill-rose-500 text-rose-500" />
      </button>
    </div>
  );
}

// ─── LikesTab ─────────────────────────────────────────────────────────────────

export function LikesTab() {
  const member = useMemo(() => getSessionMember(), []);
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const { data, loading, error, refetch } = useQuery<GetMyLikesData>(
    GET_MY_LIKES_QUERY,
    {
      skip: !member,
      variables: { likeGroup: "HOTEL" },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-and-network",
    },
  );

  const allLikes = data?.getMyLikes ?? [];
  const likes = allLikes.filter((l) => !removed.has(l.likeRefId));

  const handleUnliked = (hotelId: string) => {
    setRemoved((prev) => new Set(prev).add(hotelId));
    // Also refetch the likes list to keep the Apollo cache in sync.
    // The optimistic `removed` set ensures instant UI feedback.
    void refetch();
  };

  return (
    <div className="space-y-5">
      {error && <ErrorNotice message={getErrorMessage(error)} />}

      {/* Loading skeleton */}
      {loading && likes.length === 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white"
            >
              <div className="h-56 animate-pulse bg-slate-100 sm:h-64" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded-full bg-slate-100" />
                <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-50" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && likes.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
            <Heart size={24} className="text-rose-300" />
          </div>
          <p className="mt-4 text-base font-semibold text-slate-700">
            No saved hotels
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Tap the heart icon on any hotel to save it here.
          </p>
          <Link
            href="/hotels"
            className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Browse hotels
          </Link>
        </div>
      )}

      {/* Grid of liked hotels */}
      {likes.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {likes.map((like) => (
            <LikedHotelItem
              key={like._id}
              hotelId={like.likeRefId}
              likedAt={like.createdAt}
              onUnliked={handleUnliked}
            />
          ))}
        </div>
      )}
    </div>
  );
}
