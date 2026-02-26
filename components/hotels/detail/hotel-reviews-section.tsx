import { memo, useCallback } from "react";
import { ErrorNotice } from "@/components/ui/error-notice";
import { formatNumber } from "@/lib/utils/format";
import type { ReviewDto } from "@/types/hotel";

interface HotelReviewsSectionProps {
  reviews: ReviewDto[];
  reviewsLoading: boolean;
  reviewsErrorMessage: string | null;
  reviewActionErrorMessage: string | null;
  reviewPage: number;
  reviewTotalPages: number;
  reviewTotal: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  canMarkHelpful: boolean;
  markingHelpfulReviewId: string | null;
  helpfulCountOverrides: Record<string, number>;
  onMarkHelpful: (reviewId: string) => void;
}

const formatDate = (value?: string | null): string => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toISOString().slice(0, 10);
};
interface RatingBarProps {
  label: string;
  rating: number;
}

function RatingBar({ label, rating }: RatingBarProps) {
  const percent = Math.max(0, Math.min(100, Math.round((rating / 5) * 100)));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <span className="text-xs font-semibold text-slate-700">{percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

interface ReviewRowProps {
  review: ReviewDto;
  helpfulCount: number;
  canMarkHelpful: boolean;
  isMarkingHelpful: boolean;
  onMarkHelpful: (reviewId: string) => void;
}

const ReviewRow = memo(function ReviewRow({
  review,
  helpfulCount,
  canMarkHelpful,
  isMarkingHelpful,
  onMarkHelpful,
}: ReviewRowProps) {
  const handleMarkHelpful = useCallback(() => {
    onMarkHelpful(review._id);
  }, [onMarkHelpful, review._id]);

  return (
    <article className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 transition duration-300 hover:-translate-y-0.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{review.reviewTitle || "Guest review"}</p>
          <p className="text-xs text-slate-500">{formatDate(review.createdAt)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-900">{review.overallRating.toFixed(1)} / 5</p>
          <p className="text-xs text-slate-500">Verified stay: {review.verifiedStay ? "Yes" : "No"}</p>
        </div>
      </div>

      <p className="text-sm leading-6 text-slate-700">{review.reviewText}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <RatingBar label="Cleanliness" rating={review.cleanlinessRating} />
        <RatingBar label="Location" rating={review.locationRating} />
        <RatingBar label="Service" rating={review.serviceRating} />
        <RatingBar label="Amenities" rating={review.amenitiesRating} />
        <RatingBar label="Value" rating={review.valueRating} />
        <div className="flex items-end">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Helpful <span className="ml-1 text-sm text-slate-800">{formatNumber(helpfulCount)}</span>
          </p>
        </div>
      </div>

      {review.hotelResponse ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Hotel response</p>
          <p className="mt-1">{review.hotelResponse.responseText}</p>
          <p className="mt-1 text-xs text-slate-500">{formatDate(review.hotelResponse.respondedAt)}</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={canMarkHelpful ? handleMarkHelpful : undefined}
        disabled={!canMarkHelpful || isMarkingHelpful}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
        title={canMarkHelpful ? "Mark this review as helpful" : "Login required to mark helpful"}
      >
        {canMarkHelpful ? (isMarkingHelpful ? "Updating..." : "Mark helpful") : "Mark helpful (login required)"}
      </button>
    </article>
  );
});

export const HotelReviewsSection = memo(function HotelReviewsSection({
  reviews,
  reviewsLoading,
  reviewsErrorMessage,
  reviewActionErrorMessage,
  reviewPage,
  reviewTotalPages,
  reviewTotal,
  onPrevPage,
  onNextPage,
  canGoPrev,
  canGoNext,
  canMarkHelpful,
  markingHelpfulReviewId,
  helpfulCountOverrides,
  onMarkHelpful,
}: HotelReviewsSectionProps) {
  return (
    <section id="reviews" className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Reviews</h2>
        <p className="text-sm text-slate-600">Verified and recent guest feedback for this hotel.</p>
      </header>

      {reviewsErrorMessage ? <ErrorNotice message={reviewsErrorMessage} /> : null}
      {reviewActionErrorMessage ? <ErrorNotice message={reviewActionErrorMessage} /> : null}

      {reviewsLoading && reviews.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">Loading reviews...</section>
      ) : null}

      {!reviewsLoading && reviews.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          No reviews yet for this hotel.
        </section>
      ) : null}

      {reviews.length > 0 ? (
        <>
          <div className="space-y-3">
            {reviews.map((review) => {
              const helpfulCount = helpfulCountOverrides[review._id] ?? review.helpfulCount;
              const isMarkingHelpful = markingHelpfulReviewId === review._id;

              return (
                <ReviewRow
                  key={review._id}
                  review={review}
                  helpfulCount={helpfulCount}
                  canMarkHelpful={canMarkHelpful}
                  isMarkingHelpful={isMarkingHelpful}
                  onMarkHelpful={onMarkHelpful}
                />
              );
            })}
          </div>

          <footer className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <p className="text-slate-600">
              Page {reviewPage} / {reviewTotalPages} · Total reviews: {formatNumber(reviewTotal)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onPrevPage}
                disabled={!canGoPrev}
                className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={onNextPage}
                disabled={!canGoNext}
                className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </footer>
        </>
      ) : null}
    </section>
  );
});
