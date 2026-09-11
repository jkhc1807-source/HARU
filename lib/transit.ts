import type { TransitInfo } from "./trip-types";

export type TransitPoint = { id: string; x: number; y: number };
type NearbyPlace = { place_name?: string };
type SearchNearby = (point: TransitPoint, query: string, categoryCode?: string) => Promise<NearbyPlace[]>;

export async function findDepartureTransit(departure: TransitPoint | null, searchNearby: SearchNearby): Promise<Record<string, TransitInfo>> {
  if (!departure) return {};
  const [subways, buses] = await Promise.all([
    searchNearby(departure, "", "SW8"),
    searchNearby(departure, "버스정류장"),
  ]);
  return { [departure.id]: { subway: subways[0]?.place_name, bus: buses[0]?.place_name } };
}
