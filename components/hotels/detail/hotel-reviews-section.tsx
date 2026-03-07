import { memo, useCallback } from "react";
import Image from "next/image";
import { ErrorNotice } from "@/components/ui/error-notice";
import { useI18n } from "@/lib/i18n/provider";
import { formatNumber } from "@/lib/utils/format";
import { resolveMediaUrl } from "@/lib/utils/media-url";
import type { ReviewDto, ReviewRatingsSummaryDto } from "@/types/hotel";

interface HotelReviewsSectionProps {
  reviews: ReviewDto[];
  reviewsLoading: boolean;
  reviewsErrorMessage: string | null;
  reviewActionErrorMessage: string | null;
  reviewPage: number;
  reviewTotalPages: number;
  reviewTotal: number;
  ratingsSummary: ReviewRatingsSummaryDto | null;
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

const getReviewerDisplayName = (review: ReviewDto): string => {
  const nick = review.reviewerNick?.trim();
  if (nick) {
    return nick;
  }

  return review.reviewerId.slice(-4);
};

const getReviewerInitial = (review: ReviewDto): string =>
  getReviewerDisplayName(review).slice(0, 1).toUpperCase();

interface RatingBarProps {
  label: string;
  rating: number;
}

function RatingBar({ label, rating }: RatingBarProps) {
  const percent = Math.max(0, Math.min(100, Math.round((rating / 5) * 100)));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
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
  const { t } = useI18n();
  const handleMarkHelpful = useCallback(() => {
    onMarkHelpful(review._id);
  }, [onMarkHelpful, review._id]);
  const reviewerName = getReviewerDisplayName(review);
  const reviewerInitial = getReviewerInitial(review);
  const reviewerImageUrl = resolveMediaUrl(review.reviewerImage);
  const reviewerLabel = review.reviewerNick?.trim()
    ? reviewerName
    : t("hotel_reviews_guest_fallback", { suffix: reviewerName });

  return (
    <article className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {reviewerImageUrl ? (
            <Image
              src={reviewerImageUrl}
              alt={reviewerLabel}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
              {reviewerInitial}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {reviewerLabel}
            </p>
            <p className="text-xs text-slate-500">
              {formatDate(review.createdAt)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-900">
            {review.overallRating.toFixed(1)} / 5
          </p>
          <p className="text-xs text-slate-500">
            {t("hotel_reviews_verified_stay")}: {review.verifiedStay ? t("hotel_reviews_yes") : t("hotel_reviews_no")}
          </p>
        </div>
      </div>

      {review.reviewTitle ? (
        <p className="text-sm font-semibold text-slate-900">
          {review.reviewTitle}
        </p>
      ) : null}
      <p className="text-sm leading-6 text-slate-700">{review.reviewText}</p>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {t("hotel_reviews_helpful")}{" "}
        <span className="ml-1 text-sm text-slate-800">
          {formatNumber(helpfulCount)}
        </span>
      </p>

      {review.hotelResponse ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <p className="font-medium text-slate-900">{t("hotel_reviews_response")}</p>
          <p className="mt-1">{review.hotelResponse.responseText}</p>
          <p className="mt-1 text-xs text-slate-500">
            {formatDate(review.hotelResponse.respondedAt)}
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={canMarkHelpful ? handleMarkHelpful : undefined}
        disabled={!canMarkHelpful || isMarkingHelpful}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
        title={
          canMarkHelpful
            ? t("hotel_reviews_mark_helpful")
            : t("hotel_reviews_mark_helpful_login")
        }
      >
        {canMarkHelpful
          ? isMarkingHelpful
            ? t("hotel_reviews_updating")
            : t("hotel_reviews_mark_helpful")
          : t("hotel_reviews_mark_helpful_login")}
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
  ratingsSummary,
  onPrevPage,
  onNextPage,
  canGoPrev,
  canGoNext,
  canMarkHelpful,
  markingHelpfulReviewId,
  helpfulCountOverrides,
  onMarkHelpful,
}: HotelReviewsSectionProps) {
  const { t } = useI18n();
  return (
    <section id="reviews" className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">{t("hotel_reviews_title")}</h2>
        <p className="text-sm text-slate-600">
          {t("hotel_reviews_desc")}
        </p>
      </header>

      {reviewsErrorMessage ? (
        <ErrorNotice message={reviewsErrorMessage} />
      ) : null}
      {reviewActionErrorMessage ? (
        <ErrorNotice message={reviewActionErrorMessage} />
      ) : null}

      {reviewsLoading && reviews.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          {t("hotel_reviews_loading")}
        </section>
      ) : null}

      {!reviewsLoading && reviews.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          {t("hotel_reviews_empty")}
        </section>
      ) : null}

      {reviews.length > 0 ? (
        <>
          {ratingsSummary ? (
            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 hover-lift">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {t("hotel_reviews_average_title")}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t("hotel_reviews_average_desc")}
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {ratingsSummary.overallRating.toFixed(2)} / 5 ·{" "}
                  {formatNumber(ratingsSummary.totalReviews)} {t("hotel_reviews_title").toLowerCase()}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <RatingBar
                  label={t("review_label_overall")}
                  rating={ratingsSummary.overallRating}
                />
                <RatingBar
                  label={t("review_label_cleanliness")}
                  rating={ratingsSummary.cleanlinessRating}
                />
                <RatingBar
                  label={t("review_label_location")}
                  rating={ratingsSummary.locationRating}
                />
                <RatingBar
                  label={t("review_label_service")}
                  rating={ratingsSummary.serviceRating}
                />
                <RatingBar
                  label={t("review_label_amenities")}
                  rating={ratingsSummary.amenitiesRating}
                />
                <RatingBar label={t("review_label_value")} rating={ratingsSummary.valueRating} />
              </div>
            </section>
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            {reviews.map((review) => {
              const helpfulCount =
                helpfulCountOverrides[review._id] ?? review.helpfulCount;
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
              {t("hotel_reviews_pagination", {
                page: reviewPage,
                totalPages: reviewTotalPages,
                total: formatNumber(reviewTotal),
              })}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onPrevPage}
                disabled={!canGoPrev}
                className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("hotel_reviews_previous")}
              </button>
              <button
                type="button"
                onClick={onNextPage}
                disabled={!canGoNext}
                className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("hotel_reviews_next")}
              </button>
            </div>
          </footer>
        </>
      ) : null}
    </section>
  );
});
