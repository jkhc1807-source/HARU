import type { SavedTrip, Spot } from "./trip-types";

function isStoredSpot(value: unknown): value is Spot {
  if (!value || typeof value !== "object") return false;
  const spot = value as Partial<Spot>;
  return typeof spot.id === "string" && typeof spot.name === "string" && typeof spot.category === "string"
    && typeof spot.address === "string" && Number.isFinite(spot.x) && Number.isFinite(spot.y)
    && Number.isFinite(spot.stay) && typeof spot.emoji === "string" && (spot.note === undefined || typeof spot.note === "string");
}

export function readStoredTrip(value: string | null) {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.every(isStoredSpot) ? { version: 1, city: null, startTime: "", endTime: "", selected: null, plan: parsed } : null;
    }
    if (!parsed || typeof parsed !== "object") return null;
    const trip = parsed as { version?: unknown; city?: unknown; startTime?: unknown; endTime?: unknown; selected?: unknown; plan?: unknown };
    if (!Array.isArray(trip.plan) || !trip.plan.every(isStoredSpot)) return null;
    return {
      version: trip.version === 2 ? 2 : 1,
      city: typeof trip.city === "string" ? trip.city : null,
      startTime: typeof trip.startTime === "string" ? trip.startTime : "",
      endTime: typeof trip.endTime === "string" ? trip.endTime : "",
      selected: Array.isArray(trip.selected) && trip.selected.every(item => typeof item === "string") ? trip.selected : null,
      plan: trip.plan,
    };
  } catch {
    return null;
  }
}

export function readStoredTrips(value: string | null): SavedTrip[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => {
      if (!item || typeof item !== "object") return false;
      const trip = item as Partial<SavedTrip>;
      return typeof trip.id === "string" && typeof trip.name === "string" && typeof trip.city === "string"
        && Number.isFinite(trip.updatedAt) && Array.isArray(trip.plan) && trip.plan.every(isStoredSpot);
    }).map(item => {
      const trip = item as Partial<SavedTrip>;
      return { ...trip, version: 2, startTime: typeof trip.startTime === "string" ? trip.startTime : "", endTime: typeof trip.endTime === "string" ? trip.endTime : "", selected: Array.isArray(trip.selected) ? trip.selected : [] } as SavedTrip;
    });
  } catch {
    return [];
  }
}

export function readSharedTrip(hash: string) {
  if (!hash.startsWith("#trip=")) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(hash.slice(6)));
    if (!parsed || typeof parsed !== "object") return null;
    const trip = parsed as { city?: unknown; startTime?: unknown; endTime?: unknown; selected?: unknown; plan?: unknown };
    if (typeof trip.city !== "string" || typeof trip.startTime !== "string" || typeof trip.endTime !== "string"
      || !Array.isArray(trip.selected) || !trip.selected.every(item => typeof item === "string")
      || !Array.isArray(trip.plan) || !trip.plan.every(isStoredSpot)) return null;
    return { city: trip.city, startTime: trip.startTime, endTime: trip.endTime, selected: trip.selected as string[], plan: trip.plan as Spot[] };
  } catch {
    return null;
  }
}
