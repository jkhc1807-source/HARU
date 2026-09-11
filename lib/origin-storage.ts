import type { FavoriteOrigin, Origin } from "./trip-types";

export function isOrigin(value: unknown): value is Origin {
  if (!value || typeof value !== "object") return false;
  const origin = value as Partial<Origin>;
  return typeof origin.placeName === "string" && typeof origin.address === "string"
    && Number.isFinite(origin.x) && Number.isFinite(origin.y);
}

function isFavoriteOrigin(value: unknown): value is FavoriteOrigin {
  if (!isOrigin(value)) return false;
  const favorite = value as Partial<FavoriteOrigin>;
  return typeof favorite.id === "string" && typeof favorite.label === "string" && Number.isFinite(favorite.updatedAt);
}

export function readStoredOrigin(value: string | null): Origin | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isOrigin(parsed)) return null;
    return { placeName: parsed.placeName, address: parsed.address, x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}

export function readStoredFavoriteOrigins(value: string | null): FavoriteOrigin[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isFavoriteOrigin) : [];
  } catch {
    return [];
  }
}

export function mergeFavoriteOrigins(local: FavoriteOrigin[], remote: FavoriteOrigin[]) {
  const newestByLabel = new Map<string, FavoriteOrigin>();
  for (const favorite of [...local, ...remote]) {
    const current = newestByLabel.get(favorite.label);
    if (!current || favorite.updatedAt > current.updatedAt) newestByLabel.set(favorite.label, favorite);
  }
  return [...newestByLabel.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12);
}
