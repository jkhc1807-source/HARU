import type { SavedTrip, Spot } from "./trip-types";

export function mergeSavedTrips(local: SavedTrip[], remote: SavedTrip[]) {
  const newestByName = new Map<string, SavedTrip>();
  for (const trip of [...local, ...remote]) {
    const current = newestByName.get(trip.name);
    if (!current || trip.updatedAt > current.updatedAt) newestByName.set(trip.name, trip);
  }
  return [...newestByName.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12);
}

export function savedTripsFromRows(rows: unknown[]) {
  return rows.flatMap(row => {
    if (!row || typeof row !== "object") return [];
    const value = row as Record<string, unknown>;
    const plan = value.plan;
    const updatedAt = typeof value.updated_at === "string" ? Date.parse(value.updated_at) : NaN;
    if (typeof value.id !== "string" || typeof value.name !== "string" || typeof value.city !== "string"
      || !Number.isFinite(updatedAt) || !Array.isArray(plan) || !plan.every(isSavedSpot)) return [];
    return [{
      version: 2,
      id: value.id, name: value.name, city: value.city,
      startTime: typeof value.start_time === "string" ? value.start_time : "",
      endTime: typeof value.end_time === "string" ? value.end_time : "",
      selected: Array.isArray(value.preferences) && value.preferences.every(item => typeof item === "string") ? value.preferences : [],
      plan: value.plan,
      updatedAt,
    } as SavedTrip];
  });
}

function isSavedSpot(value: unknown): value is Spot {
  if (!value || typeof value !== "object") return false;
  const spot = value as Partial<Spot>;
  return typeof spot.id === "string" && typeof spot.name === "string" && typeof spot.category === "string"
    && typeof spot.address === "string" && Number.isFinite(spot.x) && Number.isFinite(spot.y)
    && Number.isFinite(spot.stay) && typeof spot.emoji === "string";
}
