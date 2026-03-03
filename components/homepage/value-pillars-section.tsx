import type { ValuePillar } from "@/types/homepage";
import styles from "@/styles/home-landing-ovastin.module.css";

interface ValuePillarsSectionProps {
  pillars: ValuePillar[];
}

export function ValuePillarsSection({ pillars }: ValuePillarsSectionProps) {
  if (pillars.length === 0) return null;

  return (
    <section className={styles.valueSection}>
      <div className={styles.valueHeader}>
        <p className={styles.valueEyebrow}>Why guests choose Meomul</p>
        <h2 className={styles.valueTitle}>Built for decision speed and booking confidence</h2>
      </div>

      <div className={styles.valueGrid}>
        {pillars.map((pillar) => (
          <article key={pillar.title} className={styles.valueCard}>
            <p className={styles.valueCardTitle}>{pillar.title}</p>
            <p className={styles.valueCardMetric}>{pillar.metric}</p>
            <p className={styles.valueCardDetail}>{pillar.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
