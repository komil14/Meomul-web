import { ErrorNotice } from "@/components/ui/error-notice";
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

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toISOString().slice(0, 10);
};
const asPercent = (rating: number): string => `${Math.round((rating / 5) * 100)}%`;

export function HotelReviewsSection({
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

              return (
                <article key={review._id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 transition duration-300 hover:-translate-y-0.5">
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

                  <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                    <p>Cleanliness: {asPercent(review.cleanlinessRating)}</p>
                    <p>Location: {asPercent(review.locationRating)}</p>
                    <p>Service: {asPercent(review.serviceRating)}</p>
                    <p>Amenities: {asPercent(review.amenitiesRating)}</p>
                    <p>Value: {asPercent(review.valueRating)}</p>
                    <p>Helpful: {helpfulCount.toLocaleString()}</p>
                  </div>

                  {review.hotelResponse ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <p className="font-medium text-slate-900">Hotel response</p>
                      <p className="mt-1">{review.hotelResponse.responseText}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(review.hotelResponse.respondedAt)}</p>
                    </div>
                  ) : null}

                  {canMarkHelpful ? (
                    <button
                      type="button"
                      onClick={() => onMarkHelpful(review._id)}
                      disabled={markingHelpfulReviewId === review._id}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {markingHelpfulReviewId === review._id ? "Updating..." : "Mark helpful"}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>

          <footer className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <p className="text-slate-600">
              Page {reviewPage} / {reviewTotalPages} · Total reviews: {reviewTotal.toLocaleString()}
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
}
