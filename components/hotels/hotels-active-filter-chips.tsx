import type { HotelsPageQueryState } from "@/lib/hooks/use-hotels-page-query-state";
import {
  buildHotelsArraySummary,
  formatHotelDateSummary,
  formatHotelLocationLabel,
} from "@/lib/hotels/hotels-ui";

interface HotelsActiveFilterChipsProps {
  state: HotelsPageQueryState;
}

interface ActiveChip {
  id: string;
  label: string;
  clearPatch: Record<string, string | undefined>;
}

export function HotelsActiveFilterChips({ state }: HotelsActiveFilterChipsProps) {
  const chips: ActiveChip[] = [];

  if (state.textInput.trim()) {
    chips.push({
      id: "q",
      label: `Search: "${state.textInput.trim()}"`,
      clearPatch: { q: undefined },
    });
  }

  if (state.selectedLocation) {
    chips.push({
      id: "location",
      label: `Location: ${formatHotelLocationLabel(state.selectedLocation)}`,
      clearPatch: { location: undefined },
    });
  }

  if (state.selectedPurpose) {
    chips.push({
      id: "purpose",
      label: `Purpose: ${state.selectedPurpose}`,
      clearPatch: { purpose: undefined },
    });
  }

  if (state.checkInInput || state.checkOutInput) {
    chips.push({
      id: "stay",
      label: `Stay: ${formatHotelDateSummary(state.checkInInput, state.checkOutInput)}`,
      clearPatch: { checkIn: undefined, checkOut: undefined },
    });
  }

  if (state.guestCountInput) {
    chips.push({
      id: "guests",
      label: `Guests: ${state.guestCountInput}`,
      clearPatch: { guests: undefined },
    });
  }

  if (state.minInput || state.maxInput) {
    chips.push({
      id: "price",
      label: `Price: ₩${state.minInput || "0"} - ₩${state.maxInput || "any"}`,
      clearPatch: { min: undefined, max: undefined },
    });
  }

  if (state.minRatingInput) {
    chips.push({
      id: "minRating",
      label: `Rating: ${state.minRatingInput}+`,
      clearPatch: { minRating: undefined },
    });
  }

  if (state.verifiedOnly) {
    chips.push({
      id: "verified",
      label: "Verified only",
      clearPatch: { verified: undefined },
    });
  }
  if (state.petsAllowed) {
    chips.push({
      id: "pets",
      label: "Pets allowed",
      clearPatch: { pets: undefined },
    });
  }
  if (state.wheelchairAccessible) {
    chips.push({
      id: "wheelchair",
      label: "Wheelchair access",
      clearPatch: { wheelchair: undefined },
    });
  }

  if (state.selectedTypes.length > 0) {
    chips.push({
      id: "hotelTypes",
      label: buildHotelsArraySummary(state.selectedTypes, "Hotel type"),
      clearPatch: { types: undefined },
    });
  }

  if (state.selectedRoomTypes.length > 0) {
    chips.push({
      id: "roomTypes",
      label: buildHotelsArraySummary(state.selectedRoomTypes, "Room type"),
      clearPatch: { roomTypes: undefined },
    });
  }

  if (state.selectedStarRatings.length > 0) {
    chips.push({
      id: "stars",
      label: buildHotelsArraySummary(state.selectedStarRatings.map(String), "Star"),
      clearPatch: { stars: undefined },
    });
  }

  if (state.selectedAmenities.length > 0) {
    chips.push({
      id: "amenities",
      label: `${state.selectedAmenities.length} amenities`,
      clearPatch: { amenities: undefined },
    });
  }

  if (state.dongInput || state.nearestSubwayInput || state.subwayLinesInput || state.maxWalkingDistanceInput) {
    chips.push({
      id: "transit",
      label: "Transit/location details",
      clearPatch: { dong: undefined, subway: undefined, lines: undefined, walk: undefined },
    });
  }

  if (chips.length === 0) {
    return null;
  }

  const mobileVisibleChips = chips.slice(0, 3);
  const hiddenChipCount = Math.max(0, chips.length - mobileVisibleChips.length);

  const renderChip = (chip: ActiveChip) => (
    <button
      key={chip.id}
      type="button"
      onClick={() => {
        state.patchQuery(chip.clearPatch);
      }}
      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-500"
    >
      <span>{chip.label}</span>
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-600">x</span>
    </button>
  );

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 sm:hidden">
        {mobileVisibleChips.map((chip) => renderChip(chip))}
        {hiddenChipCount > 0 ? (
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
            +{hiddenChipCount} more
          </span>
        ) : null}
      </div>
      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        {chips.map((chip) => renderChip(chip))}
      </div>
    </section>
  );
}
