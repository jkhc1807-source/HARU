import type { FavoriteOrigin } from "./trip-types";
import { getSupabaseBrowserClient } from "./supabase/client";

function requireClient() {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("SUPABASE_NOT_CONFIGURED");
  return client;
}

function favoriteFromRow(row: unknown): FavoriteOrigin[] {
  if (!row || typeof row !== "object") return [];
  const value = row as Record<string, unknown>;
  const updatedAt = typeof value.updated_at === "string" ? Date.parse(value.updated_at) : NaN;
  if (typeof value.id !== "string" || typeof value.label !== "string" || typeof value.place_name !== "string"
    || !Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(updatedAt)) return [];
  return [{
    id: value.id,
    label: value.label,
    placeName: value.place_name,
    address: typeof value.address === "string" ? value.address : "",
    x: value.x as number,
    y: value.y as number,
    updatedAt,
  }];
}

export async function listFavoriteOrigins(userId: string) {
  const { data, error } = await requireClient()
    .from("favorite_origins")
    .select("id,label,place_name,address,x,y,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data ?? []).flatMap(favoriteFromRow);
}

export async function upsertFavoriteOrigin(userId: string, favorite: FavoriteOrigin) {
  const { error } = await requireClient().from("favorite_origins").upsert({
    id: favorite.id,
    user_id: userId,
    label: favorite.label,
    place_name: favorite.placeName,
    address: favorite.address,
    x: favorite.x,
    y: favorite.y,
    updated_at: new Date(favorite.updatedAt).toISOString(),
  }, { onConflict: "user_id,label" });
  if (error) throw error;
}

export async function deleteFavoriteOrigin(userId: string, favoriteId: string) {
  const { error } = await requireClient().from("favorite_origins").delete().eq("id", favoriteId).eq("user_id", userId);
  if (error) throw error;
}
