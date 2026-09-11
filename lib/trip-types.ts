export type Spot = { id: string; name: string; category: string; address: string; x: number; y: number; stay: number; emoji: string; placeUrl?: string; note?: string };
export type Origin = { placeName: string; address: string; x: number; y: number };
export type FavoriteOrigin = Origin & { id: string; label: string; updatedAt: number };
export type ScheduleItem = { spot: Spot; start: string; end: string; travelToNext: number };
export type UndoState = { plan: Spot[]; message: string };
export type TripSettings = { version: 2; city: string; startTime: string; endTime: string; selected: string[]; plan: Spot[]; origin: Origin | null };
export type SavedTrip = TripSettings & { id: string; name: string; updatedAt: number };
export type TransitInfo = { subway?: string; bus?: string };
