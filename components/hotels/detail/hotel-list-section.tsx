import { HotelCard } from "@/components/hotels/hotel-card";
import { ErrorNotice } from "@/components/ui/error-notice";
import type { HotelListItem } from "@/types/hotel";

interface HotelListSectionProps {
  title: string;
  description: string;
  hotels: HotelListItem[];
  loading: boolean;
  loadingText: string;
  errorMessage: string | null;
}

export function HotelListSection({ title, description, hotels, loading, loadingText, errorMessage }: HotelListSectionProps) {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600">{description}</p>
      </header>

      {errorMessage ? <ErrorNotice message={errorMessage} /> : null}
      {loading && hotels.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">{loadingText}</section>
      ) : null}
      {hotels.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hotels.map((entry) => (
            <HotelCard key={entry._id} hotel={entry} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
