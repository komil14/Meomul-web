import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatHotelLocationLabel } from "@/lib/hotels/hotels-ui";
import { useI18n } from "@/lib/i18n/provider";
import type { RecommendedCard } from "@/types/homepage";
import styles from "@/styles/home-landing-ovastin.module.css";

interface RecommendedSectionProps {
  cards: RecommendedCard[];
  rows: RecommendedCard[][];
  isPersonalizing: boolean;
}

export function RecommendedSection({ cards, rows, isPersonalizing }: RecommendedSectionProps) {
  const { t } = useI18n();
  const [activeCard, setActiveCard] = useState(1);

  useEffect(() => {
    if (cards.length === 0) return;
    if (activeCard >= cards.length) {
      setActiveCard(Math.max(0, cards.length - 1));
    }
  }, [activeCard, cards.length]);

  if (cards.length === 0) return null;

  return (
    <section className={styles.signatureSection}>
      <div className={styles.signatureHeader}>
        <p className={styles.signatureEyebrow}>
          {isPersonalizing ? t("home_recommended_personalizing") : t("home_recommended_eyebrow")}
        </p>
        <h2 className={styles.signatureTitle}>{t("home_recommended_title")}</h2>
        <p className={styles.signatureDescription}>
          {t("home_recommended_desc")}
        </p>
      </div>

      <div className={styles.signatureRows}>
        {rows.map((row, rowIndex) => (
          <div key={`recommended-row-${rowIndex}`} className={styles.signatureRow}>
            {row.map((hotel, colIndex) => {
              const globalIndex = rowIndex * 3 + colIndex;
              const isActive = globalIndex === activeCard;

              return (
                <article
                  key={`recommended-hotel-${hotel._id}`}
                  className={`${styles.signatureCard} ${isActive ? styles.signatureCardActive : ""}`}
                  onMouseEnter={() => setActiveCard(globalIndex)}
                  onFocus={() => setActiveCard(globalIndex)}
                >
                  <Link href={`/hotels/${hotel._id}`} className={styles.signatureCardLink}>
                    {hotel.imageUrl ? (
                      <Image
                        src={hotel.imageUrl}
                        alt={hotel.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1180px) 50vw, 33vw"
                        className={styles.signatureCardImage}
                      />
                    ) : (
                      <div className={styles.signatureCardFallback} />
                    )}
                    <div className={styles.signatureCardShade} />
                    <div className={styles.signatureCardContent}>
                      <h3>{hotel.title}</h3>
                      <p className={styles.signatureCardMeta}>
                        {formatHotelLocationLabel(hotel.location)} · {hotel.hotelType} · ★{" "}
                        {hotel.rating.toFixed(1)}
                      </p>
                      <p className={styles.signatureCardSignal}>{hotel.signal}</p>
                      <span className={styles.signatureCardCta}>
                        {t("home_view_details")}
                        <span aria-hidden>↗</span>
                      </span>
                    </div>
                  </Link>
                </article>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
