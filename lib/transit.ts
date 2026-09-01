import type { Spot, TransitInfo } from "./trip-types";

type NearbyPlace = { place_name?: string };
type SearchNearby = (spot: Spot, query: string, categoryCode?: string) => Promise<NearbyPlace[]>;

export async function findDepartureTransit(plan: Spot[], searchNearby: SearchNearby): Promise<Record<string, TransitInfo>> {
  const departure = plan[0];
  if (!departure) return {};
  const [subways, buses] = await Promise.all([
    searchNearby(departure, "", "SW8"),
    searchNearby(departure, "버스정류장"),
  ]);
  return { [departure.id]: { subway: subways[0]?.place_name, bus: buses[0]?.place_name } };
}
