import type { SavedTrip } from "./trip-types";

export function mergeSavedTrips(local: SavedTrip[], remote: SavedTrip[]) {
  const newestByName = new Map<string, SavedTrip>();
  for (const trip of [...local, ...remote]) {
    const current = newestByName.get(trip.name);
    if (!current || trip.updatedAt > current.updatedAt) newestByName.set(trip.name, trip);
  }
  return [...newestByName.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12);
}
