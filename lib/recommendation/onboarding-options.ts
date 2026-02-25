import type { HotelLocation } from "@/types/hotel";
import type { BudgetLevel, TravelStyle } from "@/types/recommendation";

export const MAX_TRAVEL_STYLES = 3;
export const MAX_DESTINATIONS = 4;
export const MAX_AMENITIES = 5;

export const TRAVEL_STYLE_OPTIONS: Array<{ value: TravelStyle; label: string; description: string }> = [
  { value: "SOLO", label: "Solo", description: "Quiet, flexible stays for one traveler." },
  { value: "FAMILY", label: "Family", description: "Family-friendly spaces and practical amenities." },
  { value: "COUPLE", label: "Couple", description: "Romantic stays with comfort and privacy." },
  { value: "FRIENDS", label: "Friends", description: "Social, fun stays for groups." },
  { value: "BUSINESS", label: "Business", description: "Work-ready stays with reliable access." },
];

export const DESTINATION_OPTIONS: Array<{ value: HotelLocation; label: string }> = [
  { value: "SEOUL", label: "Seoul" },
  { value: "BUSAN", label: "Busan" },
  { value: "INCHEON", label: "Incheon" },
  { value: "DAEGU", label: "Daegu" },
  { value: "GWANGJU", label: "Gwangju" },
  { value: "DAEJON", label: "Daejeon" },
  { value: "JEJU", label: "Jeju" },
  { value: "GYEONGJU", label: "Gyeongju" },
  { value: "GANGNEUNG", label: "Gangneung" },
];

export const AMENITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "wifi", label: "Fast Wi-Fi" },
  { value: "workspace", label: "Workspace" },
  { value: "meetingRoom", label: "Meeting room" },
  { value: "parking", label: "Parking" },
  { value: "breakfast", label: "Breakfast" },
  { value: "roomService", label: "Room service" },
  { value: "gym", label: "Gym" },
  { value: "pool", label: "Pool" },
  { value: "spa", label: "Spa" },
  { value: "restaurant", label: "Restaurant" },
  { value: "familyRoom", label: "Family room" },
  { value: "kidsFriendly", label: "Kids-friendly" },
  { value: "playground", label: "Playground" },
  { value: "coupleRoom", label: "Couple room" },
  { value: "romanticView", label: "Romantic view" },
  { value: "privateBath", label: "Private bath" },
  { value: "airportShuttle", label: "Airport shuttle" },
  { value: "wheelchairAccessible", label: "Wheelchair accessible" },
  { value: "elevator", label: "Elevator" },
  { value: "serviceAnimalsAllowed", label: "Service animals allowed" },
];

export const BUDGET_OPTIONS: Array<{ value: BudgetLevel; label: string; range: string }> = [
  { value: "BUDGET", label: "Budget", range: "₩30k - ₩80k / night" },
  { value: "MID", label: "Mid", range: "₩80k - ₩150k / night" },
  { value: "PREMIUM", label: "Premium", range: "₩150k - ₩300k / night" },
  { value: "LUXURY", label: "Luxury", range: "₩300k+ / night" },
];

const DESTINATION_SET = new Set<HotelLocation>(DESTINATION_OPTIONS.map((option) => option.value));
const AMENITY_SET = new Set<string>(AMENITY_OPTIONS.map((option) => option.value));
const PURPOSE_TO_TRAVEL_STYLE: Record<string, TravelStyle | undefined> = {
  SOLO: "SOLO",
  FAMILY: "FAMILY",
  ROMANTIC: "COUPLE",
  STAYCATION: "FRIENDS",
  BUSINESS: "BUSINESS",
};

export const toggleWithLimit = <T extends string>(current: T[], nextValue: T, limit: number): T[] => {
  if (current.includes(nextValue)) {
    return current.filter((item) => item !== nextValue);
  }

  if (current.length >= limit) {
    return current;
  }

  return [...current, nextValue];
};

export const toValidDestinationList = (locations: string[] | undefined): HotelLocation[] => {
  if (!locations || locations.length === 0) {
    return [];
  }

  return locations.filter((location): location is HotelLocation => DESTINATION_SET.has(location as HotelLocation));
};

export const toValidAmenityList = (amenities: string[] | undefined): string[] => {
  if (!amenities || amenities.length === 0) {
    return [];
  }

  return amenities.filter((amenity) => AMENITY_SET.has(amenity));
};

export const mapPurposesToTravelStyles = (purposes: string[] | undefined): TravelStyle[] => {
  if (!purposes || purposes.length === 0) {
    return [];
  }

  const mapped = purposes
    .map((purpose) => PURPOSE_TO_TRAVEL_STYLE[purpose])
    .filter((value): value is TravelStyle => typeof value === "string");
  return Array.from(new Set(mapped)).slice(0, MAX_TRAVEL_STYLES);
};

export const mapBudgetLevelFromProfile = (avgPriceMax?: number | null): BudgetLevel | undefined => {
  if (!avgPriceMax || avgPriceMax <= 0) {
    return undefined;
  }

  if (avgPriceMax <= 80_000) {
    return "BUDGET";
  }
  if (avgPriceMax <= 150_000) {
    return "MID";
  }
  if (avgPriceMax <= 300_000) {
    return "PREMIUM";
  }
  return "LUXURY";
};
