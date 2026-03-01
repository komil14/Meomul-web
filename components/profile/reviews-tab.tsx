import { useMutation, useQuery } from "@apollo/client/react";
import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ErrorNotice } from "@/components/ui/error-notice";
import { useToast } from "@/components/ui/toast-provider";
import {
  DELETE_REVIEW_MUTATION,
  GET_MY_REVIEWS_QUERY,
  UPDATE_REVIEW_MUTATION,
} from "@/graphql/review.gql";
import { GET_HOTEL_CARD_QUERY } from "@/graphql/hotel.gql";
import { getSessionMember } from "@/lib/auth/session";
import { confirmDanger } from "@/lib/ui/alerts";
import { getErrorMessage } from "@/lib/utils/error";
import { ExternalLink, Pencil, Star, Trash2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HotelResponse {
  responseText: string;
  respondedBy: string;
  respondedAt: string;
}

interface ReviewDto {
  _id: string;
  hotelId: string;
  bookingId: string;
  overallRating: number;
  cleanlinessRating: number;
  locationRating: number;
  valueRating: number;
  serviceRating: number;
  amenitiesRating: number;
  reviewTitle?: string | null;
  reviewText: string;
  helpfulCount: number;
  hotelResponse?: HotelResponse | null;
  reviewStatus: string;
  createdAt: string;
}

interface GetMyReviewsData {
  getMyReviews: {
    list: ReviewDto[];
    metaCounter: { total: number }[];
  };
}

interface GetHotelCardData {
  getHotel: {
    _id: string;
    hotelTitle: string;
    hotelLocation: string;
    hotelType: string;
    hotelImages: string[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── HotelMiniHeader ──────────────────────────────────────────────────────────

function HotelMiniHeader({ hotelId }: { hotelId: string }) {
  const { data, loading } = useQuery<GetHotelCardData>(GET_HOTEL_CARD_QUERY, {
    variables: { hotelId },
    fetchPolicy: "cache-first",
  });

  const hotel = data?.getHotel;

  if (loading) {
    return (
      <div className="flex items-center gap-2.5">
        <div className="h-10 w-14 flex-shrink-0 animate-pulse rounded-lg bg-slate-100" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-36 animate-pulse rounded-full bg-slate-100" />
          <div className="h-2.5 w-24 animate-pulse rounded-full bg-slate-50" />
        </div>
      </div>
    );
  }

  if (!hotel) return null;

  return (
    <Link
      href={`/hotels/${hotelId}`}
      className="group flex items-center gap-2.5 rounded-xl transition hover:bg-slate-50 -mx-1 px-1 py-0.5"
    >
      <div className="relative h-10 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
        {hotel.hotelImages[0] && (
          <Image
            src={hotel.hotelImages[0]}
            alt={hotel.hotelTitle}
            fill
            sizes="56px"
            className="object-cover"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800 transition group-hover:text-slate-600">
          {hotel.hotelTitle}
        </p>
        <p className="text-xs text-slate-400">
          {hotel.hotelLocation.charAt(0) + hotel.hotelLocation.slice(1).toLowerCase()} · {hotel.hotelType}
        </p>
      </div>
      <ExternalLink size={13} className="flex-shrink-0 text-slate-300 transition group-hover:text-slate-400" />
    </Link>
  );
}

// ─── StarDisplay ──────────────────────────────────────────────────────────────

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={n <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-200"}
        />
      ))}
    </div>
  );
}

// ─── StarPicker ───────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          aria-label={`${n} star${n !== 1 ? "s" : ""}`}
        >
          <Star
            size={26}
            className={
              n <= (hovered || value)
                ? "fill-amber-400 text-amber-400"
                : "fill-slate-100 text-slate-200"
            }
          />
        </button>
      ))}
    </div>
  );
}

// ─── EditReviewModal ──────────────────────────────────────────────────────────

function EditReviewModal({
  review,
  onClose,
  onSaved,
}: {
  review: ReviewDto;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [overallRating, setOverallRating] = useState(review.overallRating);
  const [title, setTitle] = useState(review.reviewTitle ?? "");
  const [text, setText] = useState(review.reviewText);

  const [updateReview, { loading }] = useMutation(UPDATE_REVIEW_MUTATION);

  const handleSave = async () => {
    if (!text.trim() || text.trim().length < 10) {
      toast.error("Review must be at least 10 characters.");
      return;
    }
    try {
      await updateReview({
        variables: {
          input: {
            reviewId: review._id,
            overallRating,
            reviewTitle: title.trim() || undefined,
            reviewText: text.trim(),
          },
        },
      });
      toast.success("Review updated.");
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
        <h3 className="text-base font-bold text-slate-900">Edit review</h3>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Overall rating
            </label>
            <StarPicker value={overallRating} onChange={setOverallRating} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Title <span className="font-normal normal-case text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="Summarize your stay..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Review
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              maxLength={2000}
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
            />
            <span className="mt-0.5 block text-right text-xs text-slate-400">{text.length}/2000</span>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { void handleSave(); }}
            disabled={loading || !text.trim()}
            className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            {loading ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ReviewsTab ───────────────────────────────────────────────────────────────

const LIMIT = 10;

const DIMS = [
  { key: "cleanlinessRating", label: "Cleanliness" },
  { key: "locationRating", label: "Location" },
  { key: "valueRating", label: "Value" },
  { key: "serviceRating", label: "Service" },
  { key: "amenitiesRating", label: "Amenities" },
] as const;

export function ReviewsTab() {
  const toast = useToast();
  const member = useMemo(() => getSessionMember(), []);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ReviewDto | null>(null);

  const paginationInput = { page, limit: LIMIT, direction: -1 };

  const { data, loading, error, refetch } = useQuery<GetMyReviewsData>(GET_MY_REVIEWS_QUERY, {
    skip: !member,
    variables: { input: paginationInput },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-and-network",
  });

  const [deleteReview] = useMutation(DELETE_REVIEW_MUTATION, {
    onCompleted: () => {
      toast.success("Review deleted.");
      void refetch();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const reviews = data?.getMyReviews.list ?? [];
  const total = data?.getMyReviews.metaCounter[0]?.total ?? 0;
  const hasMore = page * LIMIT < total;

  const handleDelete = async (reviewId: string) => {
    const confirmed = await confirmDanger({
      title: "Delete review?",
      text: "This action cannot be undone.",
      confirmText: "Yes, delete",
    });
    if (!confirmed) return;
    await deleteReview({ variables: { reviewId } });
  };

  return (
    <>
      {editing && (
        <EditReviewModal
          review={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refetch();
          }}
        />
      )}

      <div className="space-y-4">
        {error && <ErrorNotice message={getErrorMessage(error)} />}

        {/* Loading skeleton */}
        {loading && reviews.length === 0 && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5">
                <div className="space-y-3">
                  <div className="h-4 w-1/3 animate-pulse rounded-full bg-slate-100" />
                  <div className="h-3 w-full animate-pulse rounded-full bg-slate-50" />
                  <div className="h-3 w-4/5 animate-pulse rounded-full bg-slate-50" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && reviews.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
              <Star size={24} className="fill-amber-200 text-amber-300" />
            </div>
            <p className="mt-4 text-base font-semibold text-slate-700">No reviews yet</p>
            <p className="mt-1 text-sm text-slate-400">
              Reviews you write after a stay will appear here.
            </p>
          </div>
        )}

        {/* Review list */}
        {reviews.length > 0 && (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review._id}
                className="rounded-2xl border border-slate-100 bg-white p-5 space-y-4"
              >
                <HotelMiniHeader hotelId={review.hotelId} />
                <div className="border-t border-slate-50" />

                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <StarDisplay rating={review.overallRating} />
                      <span className="text-sm font-bold text-slate-900">
                        {review.overallRating.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{formatDate(review.createdAt)}</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditing(review)}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
                    >
                      <Pencil size={12} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => { void handleDelete(review._id); }}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-500 transition hover:bg-rose-50"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </div>
                </div>

                {review.reviewTitle && (
                  <p className="font-semibold text-slate-900">{review.reviewTitle}</p>
                )}
                <p className="text-sm text-slate-700 leading-relaxed">{review.reviewText}</p>

                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
                  {DIMS.map(({ key, label }) => {
                    const val = review[key];
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">{label}</span>
                        <div className="flex items-center gap-1">
                          <div className="h-1 w-16 rounded-full bg-slate-100">
                            <div
                              className="h-1 rounded-full bg-amber-400"
                              style={{ width: `${(val / 5) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-slate-500">{val.toFixed(1)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {review.hotelResponse && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="mb-1 text-xs font-semibold text-slate-500">Hotel response</p>
                    <p className="text-sm text-slate-700">{review.hotelResponse.responseText}</p>
                  </div>
                )}

                {review.reviewStatus !== "APPROVED" && (
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      review.reviewStatus === "PENDING"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-rose-50 text-rose-600"
                    }`}
                  >
                    {review.reviewStatus.charAt(0) + review.reviewStatus.slice(1).toLowerCase()}
                  </span>
                )}
              </div>
            ))}

            {hasMore && (
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={loading}
                className="w-full rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {loading ? "Loading..." : "Load more"}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
