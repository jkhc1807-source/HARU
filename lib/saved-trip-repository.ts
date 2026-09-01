import type { SavedTrip } from "./trip-types";
import { getSupabaseBrowserClient } from "./supabase/client";
import { savedTripsFromRows } from "./trip-sync";

type SavedTripRow = {
  id: string;
  user_id: string;
  name: string;
  city: string;
  start_time: string;
  end_time: string;
  preferences: string[];
  plan: SavedTrip["plan"];
  updated_at: string;
};

function requireClient() {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("SUPABASE_NOT_CONFIGURED");
  return client;
}

export async function listSavedTrips(userId: string) {
  const { data, error } = await requireClient()
    .from("saved_trips")
    .select("id,user_id,name,city,start_time,end_time,preferences,plan,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return savedTripsFromRows(data ?? []);
}

export async function upsertSavedTrip(userId: string, trip: SavedTrip) {
  const row: SavedTripRow = {
    id: trip.id,
    user_id: userId,
    name: trip.name,
    city: trip.city,
    start_time: trip.startTime,
    end_time: trip.endTime,
    preferences: trip.selected,
    plan: trip.plan,
    updated_at: new Date(trip.updatedAt).toISOString(),
  };
  const { error } = await requireClient().from("saved_trips").upsert(row, { onConflict: "user_id,name" });
  if (error) throw error;
}

export async function deleteSavedTrip(userId: string, tripId: string) {
  const { error } = await requireClient().from("saved_trips").delete().eq("id", tripId).eq("user_id", userId);
  if (error) throw error;
}
