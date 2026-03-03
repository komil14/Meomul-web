import Image from "next/image";
import Link from "next/link";
import { formatHotelLocationLabel } from "@/lib/hotels/hotels-ui";
import type { EditorialGuideCard } from "@/types/homepage";
import styles from "@/styles/home-landing-ovastin.module.css";

interface EditorialGuidesSectionProps {
  cards: EditorialGuideCard[];
}

export function EditorialGuidesSection({ cards }: EditorialGuidesSectionProps) {
  if (cards.length === 0) return null;

  return (
    <section className={styles.guidesSection}>
      <div className={styles.guidesHeader}>
        <p className={styles.guidesEyebrow}>Editorial Guides</p>
        <h2 className={styles.guidesTitle}>Start with a trip plan, not a blank search</h2>
        <p className={styles.guidesDescription}>
          Curated routes into pre-filtered results so guests can move from idea to booking faster.
        </p>
      </div>

      <div className={styles.guidesGrid}>
        {cards.map((guide) => (
          <article key={guide.id} className={styles.guideCard}>
            <Link href={guide.href} className={styles.guideCardLink}>
              {guide.imageUrl ? (
                <Image
                  src={guide.imageUrl}
                  alt={guide.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1180px) 50vw, 25vw"
                  className={styles.guideCardImage}
                />
              ) : (
                <div className={styles.guideCardFallback} />
              )}
              <div className={styles.guideCardShade} />
              <div className={styles.guideCardContent}>
                <p className={styles.guideCardEyebrow}>{guide.eyebrow}</p>
                <h3>{guide.title}</h3>
                <p className={styles.guideCardDescription}>{guide.description}</p>
                <p className={styles.guideCardMeta}>
                  {formatHotelLocationLabel(guide.location)} · {guide.checkIn} - {guide.checkOut}{" "}
                  · {guide.guests} guest{guide.guests === "1" ? "" : "s"}
                </p>
                <span className={styles.guideCardCta}>
                  Open plan <span aria-hidden>↗</span>
                </span>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
