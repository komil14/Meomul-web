import Image from "next/image";
import Link from "next/link";
import { formatHotelLocationLabel } from "@/lib/hotels/hotels-ui";
import type { LastMinuteDealCard } from "@/types/homepage";
import styles from "@/styles/home-landing-ovastin.module.css";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const formatDealExpiryLabel = (validUntil: string): string => {
  const expiresAt = new Date(validUntil);
  if (Number.isNaN(expiresAt.getTime())) return "Ends soon";
  return `Ends ${MONTH_LABELS[expiresAt.getUTCMonth()]} ${expiresAt.getUTCDate()}`;
};

interface LastMinuteDealsSectionProps {
  deals: LastMinuteDealCard[];
}

export function LastMinuteDealsSection({ deals }: LastMinuteDealsSectionProps) {
  if (deals.length === 0) return null;

  return (
    <section className={styles.dealsSection}>
      <div className={styles.dealsHeader}>
        <div>
          <p className={styles.dealsEyebrow}>Last Minute Deals</p>
          <h2 className={styles.dealsTitle}>Rooms with active limited-time pricing</h2>
        </div>
        <Link href="/hotels" className={styles.dealsLink}>
          Browse all stays <span aria-hidden>↗</span>
        </Link>
      </div>

      <div className={styles.dealsRail} role="list">
        {deals.map((deal) => (
          <article key={`deal-room-${deal.roomId}`} className={styles.dealCard} role="listitem">
            <Link href={`/rooms/${deal.roomId}`} className={styles.dealCardLink}>
              {deal.imageUrl ? (
                <Image
                  src={deal.imageUrl}
                  alt={`${deal.roomName} at ${deal.hotelTitle}`}
                  fill
                  sizes="(max-width: 640px) 88vw, (max-width: 1180px) 46vw, 28vw"
                  className={styles.dealCardImage}
                />
              ) : (
                <div className={styles.dealCardFallback} />
              )}
              <div className={styles.dealCardShade} />
              <div className={styles.dealBadge}>-{Math.round(deal.discountPercent)}%</div>
              <div className={styles.dealCardContent}>
                <p className={styles.dealHotelMeta}>
                  {formatHotelLocationLabel(deal.hotelLocation)} · {deal.hotelTitle}
                </p>
                <h3>{deal.roomName}</h3>
                <p className={styles.dealRoomMeta}>{deal.roomType} room</p>
                <div className={styles.dealPriceRow}>
                  <span className={styles.dealPrice}>₩ {deal.dealPrice.toLocaleString()}</span>
                  <span className={styles.dealOriginalPrice}>₩ {deal.basePrice.toLocaleString()}</span>
                </div>
                <p className={styles.dealExpiry}>{formatDealExpiryLabel(deal.validUntil)}</p>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
