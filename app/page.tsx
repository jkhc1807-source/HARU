"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";

declare global {
  interface Window { kakao: any }
}

type Spot = { id: string; name: string; category: string; address: string; x: number; y: number; stay: number; emoji: string; placeUrl?: string };
type ScheduleItem = { spot: Spot; start: string; end: string; travelToNext: number };
type UndoState = { plan: Spot[]; message: string };
type TransitPlace = { id: string; name: string; distance: number; placeUrl: string; kind: "지하철" | "버스" };

const sampleSpots: Spot[] = [
  { id: "1", name: "서울숲", category: "산책", address: "서울 성동구 뚝섬로 273", x: 127.0374, y: 37.5444, stay: 70, emoji: "🌳" },
  { id: "2", name: "성수연방", category: "문화공간", address: "서울 성동구 성수이로14길 14", x: 127.0570, y: 37.5414, stay: 60, emoji: "🧱" },
  { id: "3", name: "대림창고", category: "카페", address: "서울 성동구 성수이로 78", x: 127.0561, y: 37.5412, stay: 60, emoji: "☕" },
  { id: "4", name: "뚝도시장", category: "맛집", address: "서울 성동구 성덕정길 115", x: 127.0558, y: 37.5383, stay: 80, emoji: "🍜" },
];

const categories = ["카페", "맛집", "전시", "산책"];
const timeOptions = Array.from({ length: 35 }, (_, index) => {
  const minutes = 7 * 60 + index * 30;
  return {
    value: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
    label: formatTimeChoice(minutes),
  };
});
const preferenceEmoji: Record<string, string> = {
  카페: "☕",
  맛집: "🍽️",
  전시: "🖼️",
  산책: "🌿",
};

function emojiForPlace(place: any) {
  const category = `${place.category_group_name || ""} ${place.category_name || ""}`;
  if (place.category_group_code === "CE7" || /카페/.test(category)) return preferenceEmoji.카페;
  if (place.category_group_code === "FD6" || /음식점|식당|맛집/.test(category)) return preferenceEmoji.맛집;
  if (/전시|미술|박물관|문화시설|공연/.test(category)) return preferenceEmoji.전시;
  if (/공원|관광|산책|자연|명소/.test(category)) return preferenceEmoji.산책;
  return "📍";
}

function kakaoPlaceUrl(spot: Spot) {
  return spot.placeUrl || `https://map.kakao.com/link/search/${encodeURIComponent(`${spot.name} ${spot.address}`)}`;
}

function toneForSpot(spot: Spot) {
  const text = `${spot.category} ${spot.name}`;
  if (/카페/.test(text)) return "cafe";
  if (/맛집|음식점|식당|요리/.test(text)) return "food";
  if (/전시|미술|박물관|문화|공연/.test(text)) return "culture";
  if (/산책|공원|관광|자연|명소/.test(text)) return "walk";
  return "place";
}

function distance(a: Spot, b: Spot) {
  const dx = (a.x - b.x) * 88;
  const dy = (a.y - b.y) * 111;
  return Math.sqrt(dx * dx + dy * dy);
}

function travelMinutes(a: Spot, b: Spot) {
  return Math.max(5, Math.round((distance(a, b) / 4.5) * 60));
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTime(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function formatTimeChoice(totalMinutes: number) {
  if (totalMinutes === 24 * 60) return "밤 12:00";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours < 12 ? "오전" : "오후";
  const displayHour = hours % 12 || 12;
  return `${period} ${displayHour}:${String(minutes).padStart(2, "0")}`;
}

function matchesPreference(spot: Spot, preference: string) {
  const text = `${spot.category} ${spot.name}`;
  if (preference === "맛집") return /음식점|맛집|식당|요리/.test(text);
  if (preference === "전시") return /문화|전시|미술|박물관|공연/.test(text);
  if (preference === "산책") return /공원|관광|산책|자연|명소/.test(text);
  return text.includes(preference);
}

function fitSpotsToTime(candidates: Spot[], startTime: string, endTime: string) {
  const ordered: Spot[] = [];
  const rest = [...candidates];
  const budget = timeToMinutes(endTime) - timeToMinutes(startTime);
  let used = 0;
  while (rest.length && ordered.length < 6) {
    if (ordered.length) rest.sort((a, b) => distance(ordered[ordered.length - 1], a) - distance(ordered[ordered.length - 1], b));
    const candidate = rest.shift()!;
    const travel = ordered.length ? travelMinutes(ordered[ordered.length - 1], candidate) : 0;
    if (used + travel + candidate.stay > budget) continue;
    used += travel + candidate.stay;
    ordered.push(candidate);
  }
  return ordered;
}

function routeTravelMinutes(spots: Spot[]) {
  return spots.slice(0, -1).reduce((sum, spot, index) => sum + travelMinutes(spot, spots[index + 1]), 0);
}

function optimizeRoute(spots: Spot[]) {
  if (spots.length < 3) return spots;
  let best = spots;
  let bestMinutes = routeTravelMinutes(spots);

  for (const start of spots) {
    const route = [start];
    const remaining = spots.filter(spot => spot.id !== start.id);
    while (remaining.length) {
      remaining.sort((a, b) => distance(route[route.length - 1], a) - distance(route[route.length - 1], b));
      route.push(remaining.shift()!);
    }
    let improved = true;
    while (improved) {
      improved = false;
      for (let from = 1; from < route.length - 1; from += 1) {
        for (let to = from + 1; to < route.length; to += 1) {
          const candidate = [...route.slice(0, from), ...route.slice(from, to + 1).reverse(), ...route.slice(to + 1)];
          if (routeTravelMinutes(candidate) < routeTravelMinutes(route)) {
            route.splice(0, route.length, ...candidate);
            improved = true;
          }
        }
      }
    }
    const minutes = routeTravelMinutes(route);
    if (minutes < bestMinutes) {
      best = route;
      bestMinutes = minutes;
    }
  }
  return best;
}

export default function Home() {
  const [city, setCity] = useState("성수동");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(["카페", "맛집", "산책"]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [spots, setSpots] = useState<Spot[]>(sampleSpots);
  const [plan, setPlan] = useState<Spot[]>(sampleSpots);
  const [notice, setNotice] = useState("샘플 일정으로 체험 중이에요");
  const [mapReady, setMapReady] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState("");
  const [nearbyTransit, setNearbyTransit] = useState<TransitPlace[]>([]);
  const [isTransitSearching, setIsTransitSearching] = useState(false);
  const [regionSuggestions, setRegionSuggestions] = useState<string[]>([]);
  const [isRegionSearching, setIsRegionSearching] = useState(false);
  const [showRegionSuggestions, setShowRegionSuggestions] = useState(false);
  const [isPlaceSearching, setIsPlaceSearching] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [plannerNotice, setPlannerNotice] = useState("");
  const [searchNotice, setSearchNotice] = useState("지역과 장소 종류를 함께 검색해보세요");
  const [draggedSpot, setDraggedSpot] = useState<Spot | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlanAutoGenerated, setIsPlanAutoGenerated] = useState(true);
  const [activeDropIndex, setActiveDropIndex] = useState<number | null>(null);
  const [pointerPosition, setPointerPosition] = useState<{ x: number; y: number } | null>(null);
  const [routeOptimizeMessage, setRouteOptimizeMessage] = useState("");
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const timelineEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapObjectsRef = useRef<any[]>([]);
  const currentLocationMarkerRef = useRef<any>(null);
  const autoPlanCandidatesRef = useRef<Spot[]>(sampleSpots);
  const planningSettingsRef = useRef(`${startTime}|${endTime}|${selected.join(",")}`);
  const pointerDragRef = useRef<{ pointerId: number; spot: Spot } | null>(null);
  const draggedSpotRef = useRef<Spot | null>(null);
  const activeDropIndexRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("haru-trip-plan");
    if (saved) setPlan(JSON.parse(saved));
    let script: HTMLScriptElement | null = null;
    let cancelled = false;
    fetch("/map-config.json", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(({ kakaoJavaScriptKey }) => {
        if (cancelled || !kakaoJavaScriptKey || !mapEl.current) return;
        script = document.createElement("script");
        script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoJavaScriptKey}&autoload=false&libraries=services`;
        script.onload = () => window.kakao.maps.load(() => {
          if (!mapEl.current) return;
          mapRef.current = new window.kakao.maps.Map(mapEl.current, {
            center: new window.kakao.maps.LatLng(37.5444, 127.0447), level: 5,
          });
          setMapReady(true);
          setNotice("카카오맵이 연결됐어요");
        });
        script.onerror = () => setNotice("카카오 도메인 등록을 확인해주세요");
        document.head.appendChild(script);
      })
      .catch(() => setNotice("지도 설정을 불러오지 못했어요"));
    return () => { cancelled = true; script?.remove(); };
  }, []);

  useEffect(() => {
    const keyword = city.trim();
    if (!mapReady || keyword.length < 2 || !showRegionSuggestions) {
      setRegionSuggestions([]);
      setIsRegionSearching(false);
      return;
    }

    setIsRegionSearching(true);
    const timer = window.setTimeout(() => {
      const ps = new window.kakao.maps.services.Places();
      ps.keywordSearch(keyword, (data: any[], status: string) => {
        if (status !== window.kakao.maps.services.Status.OK) {
          setRegionSuggestions([]);
          setIsRegionSearching(false);
          return;
        }
        const regions = data
          .map((place: any) => place.address_name?.split(" ").slice(0, 3).join(" "))
          .filter(Boolean);
        setRegionSuggestions(Array.from(new Set(regions)).slice(0, 5) as string[]);
        setIsRegionSearching(false);
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [city, mapReady, showRegionSuggestions]);

  useEffect(() => {
    localStorage.setItem("haru-trip-plan", JSON.stringify(plan));
    if (!mapReady || !mapRef.current) return;
    mapObjectsRef.current.forEach((object) => object.setMap(null));
    mapObjectsRef.current = [];
    const bounds = new window.kakao.maps.LatLngBounds();
    const path: any[] = [];
    plan.forEach((spot, index) => {
      const pos = new window.kakao.maps.LatLng(spot.y, spot.x);
      bounds.extend(pos);
      path.push(pos);
      const content = document.createElement("div");
      content.className = "kakao-number-marker";
      content.textContent = String(index + 1);
      const marker = new window.kakao.maps.CustomOverlay({ map: mapRef.current, position: pos, content, yAnchor: 1.25 });
      mapObjectsRef.current.push(marker);

      if (index < plan.length - 1) {
        const next = plan[index + 1];
        const midpoint = new window.kakao.maps.LatLng((spot.y + next.y) / 2, (spot.x + next.x) / 2);
        const label = document.createElement("div");
        label.className = "travel-label";
        label.textContent = `도보 약 ${travelMinutes(spot, next)}분`;
        const overlay = new window.kakao.maps.CustomOverlay({ map: mapRef.current, position: midpoint, content: label, yAnchor: 0.5 });
        mapObjectsRef.current.push(overlay);
      }
    });
    if (path.length > 1) {
      const polyline = new window.kakao.maps.Polyline({ map: mapRef.current, path, strokeWeight: 5, strokeColor: "#6e8e20", strokeOpacity: 0.9, strokeStyle: "solid" });
      mapObjectsRef.current.push(polyline);
    }
    if (plan.length) mapRef.current.setBounds(bounds);
  }, [plan, mapReady]);

  useEffect(() => {
    const firstSpot = plan[0];
    if (!mapReady || !firstSpot) {
      setNearbyTransit([]);
      setIsTransitSearching(false);
      return;
    }

    let cancelled = false;
    const places = new window.kakao.maps.services.Places();
    const location = new window.kakao.maps.LatLng(firstSpot.y, firstSpot.x);
    const options = { location, radius: 2000, sort: window.kakao.maps.services.SortBy.DISTANCE };
    setIsTransitSearching(true);

    const searchSubway = new Promise<TransitPlace | null>(resolve => {
      places.categorySearch("SW8", (results: any[], status: string) => {
        if (status !== window.kakao.maps.services.Status.OK || !results[0]) return resolve(null);
        const place = results[0];
        resolve({ id: `subway-${place.id}`, name: place.place_name, distance: Number(place.distance), placeUrl: place.place_url, kind: "지하철" });
      }, options);
    });
    const searchBus = new Promise<TransitPlace | null>(resolve => {
      const district = firstSpot.address.split(" ").slice(0, 2).join(" ");
      const queries = [`${firstSpot.name} 버스정류장`, `${district} 버스정류장`, "버스정류장"];
      Promise.all(queries.map(query => new Promise<any[]>(done => {
        places.keywordSearch(query, (results: any[], status: string) => {
          done(status === window.kakao.maps.services.Status.OK ? results : []);
        }, options);
      }))).then(groups => {
        const place = groups.flat()
          .filter(item => /버스|정류장|정류소/.test(`${item.place_name} ${item.category_name}`))
          .sort((a, b) => Number(a.distance) - Number(b.distance))[0];
        if (!place) return resolve(null);
        resolve({ id: `bus-${place.id}`, name: place.place_name, distance: Number(place.distance), placeUrl: place.place_url, kind: "버스" });
      });
    });

    Promise.all([searchSubway, searchBus]).then(results => {
      if (cancelled) return;
      setNearbyTransit(results.filter((place): place is TransitPlace => Boolean(place)));
      setIsTransitSearching(false);
    });

    return () => { cancelled = true; };
  }, [plan, mapReady]);

  useEffect(() => {
    const settingsKey = `${startTime}|${endTime}|${selected.join(",")}`;
    if (planningSettingsRef.current === settingsKey) return;
    planningSettingsRef.current = settingsKey;
    if (!startTime || !endTime || !isPlanAutoGenerated || timeToMinutes(endTime) <= timeToMinutes(startTime)) return;
    const candidates = autoPlanCandidatesRef.current;
    const preferred = candidates.filter(spot => selected.some(preference => matchesPreference(spot, preference)));
    const fitted = fitSpotsToTime(preferred.length ? preferred : candidates, startTime, endTime);
    const currentIds = plan.map(spot => spot.id).join(",");
    const fittedIds = fitted.map(spot => spot.id).join(",");
    if (currentIds === fittedIds) return;
    setPlan(fitted);
    setNotice(`${startTime}–${endTime} 안에 맞춰 ${fitted.length}개 장소로 일정을 조정했어요`);
  }, [startTime, endTime, selected, isPlanAutoGenerated, plan]);

  const schedule = useMemo<ScheduleItem[]>(() => {
    let cursor = timeToMinutes(startTime || "09:30");
    return plan.map((spot, index) => {
      const start = cursor;
      const end = start + spot.stay;
      const travelToNext = index < plan.length - 1 ? travelMinutes(spot, plan[index + 1]) : 0;
      cursor = end + travelToNext;
      return { spot, start: formatTime(start), end: formatTime(end), travelToNext };
    });
  }, [plan, startTime]);

  const total = useMemo(() => plan.reduce((sum, spot) => sum + spot.stay, 0) + schedule.reduce((sum, item) => sum + item.travelToNext, 0), [plan, schedule]);
  const totalTravel = useMemo(() => schedule.reduce((sum, item) => sum + item.travelToNext, 0), [schedule]);
  const hasSelectedTimeRange = Boolean(startTime && endTime);
  const timeBudget = hasSelectedTimeRange ? Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime)) : 0;
  const hasInvalidTimeRange = hasSelectedTimeRange && timeToMinutes(endTime) <= timeToMinutes(startTime);
  const overrunMinutes = hasSelectedTimeRange ? Math.max(0, total - timeBudget) : 0;
  const plannedEndTime = formatTime(timeToMinutes(startTime || "09:30") + total);

  function updatePlan(nextPlan: Spot[], undoMessage: string) {
    setUndoState({ plan, message: undoMessage });
    setIsPlanAutoGenerated(false);
    setPlan(nextPlan);
  }

  function handleUndo() {
    if (!undoState) return;
    const currentPlan = plan;
    setPlan(undoState.plan);
    setUndoState({ plan: currentPlan, message: "방금 되돌린 변경" });
    setIsPlanAutoGenerated(false);
    setNotice(`${undoState.message} 이전으로 되돌렸어요`);
  }

  function handleShowCurrentLocation() {
    if (!mapReady || !mapRef.current) {
      setLocationNotice("지도가 연결된 뒤 다시 눌러주세요");
      return;
    }
    if (!navigator.geolocation) {
      setLocationNotice("이 브라우저에서는 위치 기능을 사용할 수 없어요");
      return;
    }

    setIsLocating(true);
    setLocationNotice("현재 위치를 찾고 있어요…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude, longitude } = coords;
        const isInsideKorea = latitude >= 32 && latitude <= 40 && longitude >= 123 && longitude <= 133;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !isInsideKorea) {
          setIsLocating(false);
          setLocationNotice("브라우저 위치가 한국 밖으로 잡혀 지도 이동을 취소했어요. 기기의 위치 설정을 확인해주세요");
          return;
        }
        const position = new window.kakao.maps.LatLng(latitude, longitude);
        currentLocationMarkerRef.current?.setMap(null);
        const content = document.createElement("div");
        content.className = "current-location-marker";
        content.setAttribute("aria-label", "내 현재 위치");
        currentLocationMarkerRef.current = new window.kakao.maps.CustomOverlay({
          map: mapRef.current,
          position,
          content,
          yAnchor: 0.5,
        });
        mapRef.current.setLevel(4);
        mapRef.current.relayout();
        mapRef.current.panTo(position);
        setIsLocating(false);
        setLocationNotice("현재 위치를 지도에 표시했어요");
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationNotice("브라우저 설정에서 위치 권한을 허용해주세요");
        } else if (error.code === error.TIMEOUT) {
          setLocationNotice("위치 확인 시간이 초과됐어요. 다시 시도해주세요");
        } else {
          setLocationNotice("현재 위치를 확인하지 못했어요");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  function handleResetPlan() {
    if (!plan.length) {
      setNotice("이미 비어 있는 일정이에요");
      return;
    }
    updatePlan([], "새 일정 시작");
    setRouteOptimizeMessage("");
    setNotice("일정을 비웠어요. 아래에서 장소를 찾거나 새로운 하루를 만들어보세요");
  }

  function handleFitToTime() {
    const fitted: Spot[] = [];
    let used = 0;
    for (const spot of plan) {
      const travel = fitted.length ? travelMinutes(fitted[fitted.length - 1], spot) : 0;
      if (used + travel + spot.stay > timeBudget) break;
      used += travel + spot.stay;
      fitted.push(spot);
    }
    updatePlan(fitted, "시간에 맞게 줄이기");
    setNotice(`${startTime}–${endTime} 안에 끝나도록 ${plan.length - fitted.length}개 장소를 제외했어요`);
  }

  function searchPlaces(e: React.FormEvent) {
    e.preventDefault();
    const keyword = query.trim();
    if (!keyword) {
      setSearchNotice("찾고 싶은 장소나 종류를 입력해주세요");
      return;
    }
    const term = `${city.trim()} ${keyword}`.trim();
    if (mapReady && window.kakao?.maps?.services) {
      setIsPlaceSearching(true);
      setSearchNotice(`‘${term}’ 장소를 찾고 있어요…`);
      const ps = new window.kakao.maps.services.Places();
      ps.keywordSearch(term, (data: any[], status: string) => {
        setIsPlaceSearching(false);
        if (status !== window.kakao.maps.services.Status.OK) {
          setSearchNotice("검색 결과가 없어요. 다른 검색어를 입력해보세요");
          return;
        }
        const found = data.slice(0, 6).map((p: any): Spot => ({
          id: p.id, name: p.place_name, category: p.category_group_name || "장소", address: p.road_address_name || p.address_name,
          x: Number(p.x), y: Number(p.y), stay: 60, emoji: emojiForPlace(p),
          placeUrl: p.place_url,
        }));
        setSpots(found);
        setSearchNotice(`‘${term}’ 실제 장소 ${found.length}곳을 찾았어요`);
      });
    } else {
      setSpots(sampleSpots.filter(s => `${s.name} ${s.category}`.includes(term) || term.includes("성수")));
      setSearchNotice("카카오맵 연결 후 실제 장소를 검색할 수 있어요");
    }
  }

  function fetchPlaces(term: string, preference: string): Promise<Spot[]> {
    return new Promise((resolve) => {
      if (!mapReady || !window.kakao?.maps?.services) return resolve([]);
      const ps = new window.kakao.maps.services.Places();
      ps.keywordSearch(term, (data: any[], status: string) => {
        if (status !== window.kakao.maps.services.Status.OK) return resolve([]);
        resolve(data.slice(0, 8).map((p: any): Spot => ({
          id: p.id,
          name: p.place_name,
          category: p.category_group_name || p.category_name?.split(" > ").pop() || "장소",
          address: p.road_address_name || p.address_name,
          x: Number(p.x),
          y: Number(p.y),
          stay: 60,
          emoji: preferenceEmoji[preference] || "📍",
          placeUrl: p.place_url,
        })));
      });
    });
  }

  async function generatePlan() {
    if (!startTime) {
      setPlannerNotice("시작 시간을 먼저 선택해주세요");
      return;
    }
    if (!endTime) {
      setPlannerNotice("종료 시간을 선택해주세요");
      return;
    }
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      setPlannerNotice("종료 시간을 시작 시간보다 늦게 설정해주세요");
      return;
    }
    if (timeToMinutes(endTime) - timeToMinutes(startTime) < 60) {
      setPlannerNotice("장소를 담을 수 있도록 이용 시간을 1시간 이상으로 설정해주세요");
      return;
    }
    if (!city.trim()) {
      setPlannerNotice("여행할 지역을 입력해주세요");
      return;
    }
    if (!selected.length) {
      setPlannerNotice("오늘의 취향을 하나 이상 골라주세요");
      return;
    }
    if (!mapReady || !window.kakao?.maps?.services) {
      setPlannerNotice("카카오맵 연결이 끝난 뒤 다시 눌러주세요");
      return;
    }

    setIsGeneratingPlan(true);
    setPlannerNotice(`${city.trim()}의 장소를 찾고 있어요…`);
    setNotice(`${city.trim()}의 장소를 찾고 있어요…`);
    try {
      const searches = await Promise.all(selected.map((preference) => fetchPlaces(`${city.trim()} ${preference}`, preference)));
      const unique = Array.from(new Map(searches.flat().map((spot) => [spot.id, spot])).values());
      if (!unique.length) {
        const message = `${city.trim()}에서 선택한 취향의 장소를 찾지 못했어요`;
        setPlannerNotice(message);
        setNotice(message);
        return;
      }
      setSpots(unique);
      const pool = unique.filter((spot) => selected.some((preference) => matchesPreference(spot, preference)));
      const candidates = pool.length ? pool : unique;
      const ordered = fitSpotsToTime(candidates, startTime, endTime);
      if (!ordered.length) {
        const message = "선택한 시간 안에 담을 장소가 없어요. 이용 시간을 조금 늘려주세요";
        setPlannerNotice(message);
        setNotice(message);
        return;
      }
      autoPlanCandidatesRef.current = unique;
      setIsPlanAutoGenerated(true);
      setPlan(ordered);
      const message = `${city.trim()}의 실제 장소 ${unique.length}곳에서 ${ordered.length}곳의 동선을 만들었어요`;
      setPlannerNotice(message);
      setNotice(message);
    } finally {
      setIsGeneratingPlan(false);
    }
  }

  function addSpot(spot: Spot) {
    if (plan.some(p => p.id === spot.id)) {
      setSearchNotice(`${spot.name}은 이미 일정에 있어요`);
      return;
    }
    const nextPlan = [...plan, spot];
    updatePlan(nextPlan, `${spot.name} 추가`);
    setSearchNotice(`${spot.name}을 일정 마지막에 추가했어요`);
  }

  function handleOptimizeRoute() {
    if (plan.length < 3) {
      setNotice("동선을 정리하려면 장소가 3개 이상 필요해요");
      setRouteOptimizeMessage("장소가 3개 이상 필요해요");
      return;
    }
    const optimized = optimizeRoute(plan);
    const savedMinutes = routeTravelMinutes(plan) - routeTravelMinutes(optimized);
    if (savedMinutes <= 0 || optimized.map(spot => spot.id).join(",") === plan.map(spot => spot.id).join(",")) {
      setNotice("현재 동선이 이미 가장 효율적이에요");
      setRouteOptimizeMessage("이미 효율적인 동선이에요");
      return;
    }
    updatePlan(optimized, "가까운 순서로 정리");
    setNotice(`동선을 정리해 예상 도보시간을 약 ${savedMinutes}분 줄였어요`);
    setRouteOptimizeMessage(`${savedMinutes}분 단축 완료`);
  }

  function handleDragStart(event: DragEvent, spot: Spot) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", spot.id);
    setDraggedSpot(spot);
    draggedSpotRef.current = spot;
    setIsDragging(true);
    if (!plan.some(item => item.id === spot.id)) {
      window.requestAnimationFrame(() => timelineEl.current?.scrollIntoView({ behavior: "auto", block: "center" }));
    }
  }

  function handleDropAt(index: number) {
    const movingSpot = draggedSpotRef.current || draggedSpot;
    if (!movingSpot) return;
    const previousIndex = plan.findIndex(item => item.id === movingSpot.id);
    const nextPlan = plan.filter(item => item.id !== movingSpot.id);
    const adjustedIndex = previousIndex >= 0 && previousIndex < index ? index - 1 : index;
    nextPlan.splice(Math.max(0, Math.min(adjustedIndex, nextPlan.length)), 0, movingSpot);
    updatePlan(nextPlan, `${movingSpot.name} 순서 변경`);
    setSearchNotice(`${movingSpot.name}의 일정 위치를 변경했어요`);
    draggedSpotRef.current = null;
    setDraggedSpot(null);
    setIsDragging(false);
    setActiveDropIndex(null);
    setPointerPosition(null);
  }

  function handleDragEnd() {
    draggedSpotRef.current = null;
    setDraggedSpot(null);
    setIsDragging(false);
    setActiveDropIndex(null);
    setPointerPosition(null);
  }

  function handlePointerDragStart(event: ReactPointerEvent<HTMLElement>, spot: Spot) {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDragRef.current = { pointerId: event.pointerId, spot };
    draggedSpotRef.current = spot;
    setDraggedSpot(spot);
    setIsDragging(true);
    setPointerPosition({ x: event.clientX, y: event.clientY });
    if (!plan.some(item => item.id === spot.id)) {
      window.requestAnimationFrame(() => timelineEl.current?.scrollIntoView({ behavior: "auto", block: "center" }));
    }
  }

  function handlePointerDragMove(event: ReactPointerEvent<HTMLElement>) {
    if (pointerDragRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    setPointerPosition({ x: event.clientX, y: event.clientY });
    const dropTarget = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-drop-index]");
    const nextDropIndex = dropTarget ? Number(dropTarget.dataset.dropIndex) : null;
    activeDropIndexRef.current = nextDropIndex;
    setActiveDropIndex(nextDropIndex);
    if (event.clientY < 90) window.scrollBy(0, -24);
    if (event.clientY > window.innerHeight - 90) window.scrollBy(0, 24);
  }

  function handlePointerDragEnd(event: ReactPointerEvent<HTMLElement>) {
    if (pointerDragRef.current?.pointerId !== event.pointerId) return;
    const dropIndex = activeDropIndexRef.current;
    pointerDragRef.current = null;
    activeDropIndexRef.current = null;
    if (dropIndex !== null) handleDropAt(dropIndex);
    else handleDragEnd();
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <span className="brand-word"><b>하루</b>여행</span>
          <small>하루가 가벼워지는 여행 플래너</small>
        </div>
        <div className="topbar-actions">
          {undoState && <button className="ghost secondary" onClick={handleUndo}>↶ 실행 취소</button>}
          <button className="ghost" onClick={handleResetPlan}>새 일정 시작</button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy"><p className="eyebrow">ONE DAY, ONE PERFECT ROUTE</p><h1>오늘 어디로<br/><em>떠나볼까요?</em></h1><p>취향과 시간을 고르면, 걷기 좋은 순서로 하루를 정리해드려요.</p></div>
        <div className="planner-card">
          <label>어디로 갈까요?</label>
          <div className="location-row">
            <div className="region-field">
              <input
                value={city}
                onChange={e => { setCity(e.target.value); setShowRegionSuggestions(true); }}
                onFocus={() => setShowRegionSuggestions(true)}
                onBlur={() => window.setTimeout(() => setShowRegionSuggestions(false), 120)}
                aria-label="여행 지역"
                aria-expanded={showRegionSuggestions && (isRegionSearching || regionSuggestions.length > 0)}
                aria-controls="region-suggestions"
                aria-autocomplete="list"
                role="combobox"
                autoComplete="off"
              />
              {showRegionSuggestions && (isRegionSearching || regionSuggestions.length > 0) && <div className="region-suggestions" id="region-suggestions" role="listbox">
                {isRegionSearching && <span>지역을 찾고 있어요…</span>}
                {!isRegionSearching && regionSuggestions.map(region => <button
                  type="button"
                  role="option"
                  aria-selected={city === region}
                  key={region}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => { setCity(region); setShowRegionSuggestions(false); }}
                >{region}</button>)}
              </div>}
            </div>
            <div className={`time-range ${hasInvalidTimeRange ? "invalid" : ""}`}>
              <label className="time-select-field">
                <span className="time-select-label">시작</span>
                <select value={startTime} onChange={e => { setStartTime(e.target.value); setEndTime(""); setPlannerNotice(""); }} aria-label="시작 시간">
                  <option value="">시간 선택</option>
                  {timeOptions.filter(option => option.value !== "24:00").map(option => <option key={`start-${option.value}`} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <span className="time-arrow" aria-hidden="true">→</span>
              <label className="time-select-field">
                <span className="time-select-label">종료</span>
                <select disabled={!startTime} value={endTime} onChange={e => { setEndTime(e.target.value); setPlannerNotice(""); }} aria-label="종료 시간" aria-invalid={hasInvalidTimeRange}>
                  <option value="">{startTime ? "시간 선택" : "시작 먼저 선택"}</option>
                  {timeOptions.filter(option => timeToMinutes(option.value) > timeToMinutes(startTime)).map(option => <option key={`end-${option.value}`} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
          </div>
          <label>오늘의 취향</label>
          <div className="chips">{categories.map(c => <button type="button" key={c} className={selected.includes(c) ? "active" : ""} aria-pressed={selected.includes(c)} onClick={() => setSelected(selected.includes(c) ? selected.filter(x => x !== c) : [...selected, c])}>{c}</button>)}</div>
          <button type="button" className="primary" disabled={isGeneratingPlan} onClick={generatePlan}>{isGeneratingPlan ? "장소를 찾고 있어요…" : "나만의 하루 만들기"} <span>{isGeneratingPlan ? "···" : "→"}</span></button>
          <p className="planner-feedback" role="status" aria-live="polite">{plannerNotice}</p>
        </div>
      </section>

      <section className="workspace">
        <div className="timeline-panel">
          <div className="section-head"><div><p>MY DAY</p><h2>{city}에서의 하루</h2></div><div className="section-tools"><div className="summary"><b>{Math.floor(total / 60)}시간 {total % 60}분</b><span>{plan.length}개 장소 · 도보 {totalTravel}분</span></div><div className="route-optimize-wrap"><button type="button" className="route-optimize" onClick={handleOptimizeRoute}>↗ 동선 정리</button><span role="status">{routeOptimizeMessage}</span></div></div></div>
          {plan[0] && <aside className="transit-guide" aria-label="첫 번째 장소 주변 대중교통">
            <div><span>첫 장소 가는 길</span><b>{plan[0].name} 주변 대중교통</b></div>
            <div className="transit-options" aria-live="polite">
              {isTransitSearching && <span className="transit-loading">가까운 역과 정류장을 찾고 있어요…</span>}
              {!isTransitSearching && nearbyTransit.map(place => <a key={place.id} href={place.placeUrl} target="_blank" rel="noopener noreferrer"><small>{place.kind === "지하철" ? "🚇 지하철" : "🚌 버스"}</small><strong>{place.name}</strong><span>약 {place.distance < 1000 ? `${Math.round(place.distance / 10) * 10}m` : `${(place.distance / 1000).toFixed(1)}km`} · 도보 {Math.max(1, Math.ceil(place.distance / 75))}분</span></a>)}
              {!isTransitSearching && nearbyTransit.length === 0 && <span className="transit-loading">2km 안에서 가까운 대중교통을 찾지 못했어요</span>}
            </div>
          </aside>}
          {overrunMinutes > 0 && <div className="time-warning" role="status"><div><b>선택한 종료 시간을 {overrunMinutes}분 초과해요</b><span>직접 추가한 장소는 임의로 지우지 않았어요.</span></div><button type="button" onClick={handleFitToTime}>시간에 맞게 줄이기</button></div>}
          <div ref={timelineEl} className={`timeline ${isDragging ? "dragging" : ""}`}>
            {plan.length === 0 && <div className={`empty-drop-zone ${activeDropIndex === 0 ? "active" : ""}`} data-drop-index="0" onDragOver={event => event.preventDefault()} onDragEnter={() => setActiveDropIndex(0)} onDrop={() => handleDropAt(0)}>
              <b>{isDragging ? "여기에 놓으세요" : "아직 일정이 비어 있어요"}</b>
              <span>아래 검색 결과를 끌어오거나 눌러서 첫 장소를 추가하세요.</span>
            </div>}
            {schedule.map(({ spot, start, end, travelToNext }, i) => <Fragment key={spot.id}>
              <div className={`drop-zone ${activeDropIndex === i ? "active" : ""}`} data-drop-index={i} onDragOver={event => event.preventDefault()} onDragEnter={() => setActiveDropIndex(i)} onDrop={() => handleDropAt(i)}><span>{i === 0 ? "맨 앞에 놓기" : "여기에 놓기"}</span></div>
              <article className={`stop tone-${toneForSpot(spot)} ${i === schedule.length - 1 ? "last" : ""}`} draggable onDragStart={event => handleDragStart(event, spot)} onDragEnd={handleDragEnd} aria-label={`${spot.name} 일정 순서 이동`}>
                <div className="time"><b>{start}</b><span>{end}</span></div>
                <div className="dot">{i + 1}</div>
                <div className="stop-card"><span className="drag-handle" role="button" aria-label={`${spot.name} 순서 이동`} tabIndex={0} onPointerDown={event => handlePointerDragStart(event, spot)} onPointerMove={handlePointerDragMove} onPointerUp={handlePointerDragEnd} onPointerCancel={handlePointerDragEnd}>⋮⋮</span><span className="emoji">{spot.emoji}</span><div><small>{spot.category} · 체류 {spot.stay}분</small><h3>{spot.name}</h3><p>{spot.address}</p><a className="kakao-review-link" href={kakaoPlaceUrl(spot)} target="_blank" rel="noopener noreferrer" draggable={false} aria-label={`${spot.name} 카카오맵 리뷰 새 창에서 열기`}>카카오맵 리뷰 ↗</a>{travelToNext > 0 && <p className="travel-meta">다음 장소까지 도보 약 {travelToNext}분</p>}</div><button aria-label={`${spot.name} 삭제`} onClick={() => updatePlan(plan.filter(p => p.id !== spot.id), `${spot.name} 삭제`)}>×</button></div>
              </article>
            </Fragment>)}
            {plan.length > 0 && <div className={`drop-zone ${activeDropIndex === plan.length ? "active" : ""}`} data-drop-index={plan.length} onDragOver={event => event.preventDefault()} onDragEnter={() => setActiveDropIndex(plan.length)} onDrop={() => handleDropAt(plan.length)}><span>마지막에 놓기</span></div>}
          </div>
        </div>

        <div className="map-panel">
          <div className="map-trip-summary" aria-label={`일정 요약, ${plan.length}개 장소, 도보 ${totalTravel}분, ${plannedEndTime} 종료`}><strong>{plan.length}곳</strong><span>도보 {totalTravel}분</span><span>{plannedEndTime} 종료</span></div>
          <div ref={mapEl} className={`map ${mapReady ? "live" : ""}`}>
            {!mapReady && <><div className="road r1"/><div className="road r2"/><div className="river"/><div className="map-label">서울숲</div>{plan.map((s, i) => <div key={s.id} className={`pin p${i + 1}`}>{i + 1}</div>)}</>}
          </div>
          <div className="map-status"><span className={mapReady ? "connected" : ""}/>{notice}</div>
          <div className="location-control">
            <button type="button" disabled={isLocating} onClick={handleShowCurrentLocation} aria-label="지도에서 내 현재 위치 보기">◎ {isLocating ? "위치 확인 중…" : "내 위치"}</button>
            <span role="status" aria-live="polite">{locationNotice}</span>
          </div>
          {mapReady && <div className="route-legend">● 방문 순서 &nbsp; ━ 예상 이동 동선</div>}
        </div>
      </section>

      <section className="search-section">
        <div><p className="eyebrow">FIND A PLACE</p><h2>일정에 장소 더하기</h2></div>
        <form onSubmit={searchPlaces}><input value={query} onChange={e => setQuery(e.target.value)} placeholder="카페, 전시관, 맛집을 검색해보세요"/><button disabled={isPlaceSearching}>{isPlaceSearching ? "검색 중…" : "검색"}</button></form>
        <p className="search-feedback" role="status">{searchNotice}</p>
        <p className="drag-guide">장소 카드를 잡으면 일정 영역으로 자동 이동해요. 원하는 사이에 놓거나, 눌러서 마지막에 추가하세요.</p>
        <div className="results">{spots.map(s => {
          const isAdded = plan.some(item => item.id === s.id);
          return <button className={`result ${isAdded ? "added" : ""}`} draggable={!isAdded} disabled={isAdded} key={s.id} onDragStart={event => handleDragStart(event, s)} onDragEnd={handleDragEnd} onClick={() => addSpot(s)}><span className="result-drag-handle" aria-hidden="true" onPointerDown={event => handlePointerDragStart(event, s)} onPointerMove={handlePointerDragMove} onPointerUp={handlePointerDragEnd} onPointerCancel={handlePointerDragEnd}>⋮⋮</span><span>{s.emoji}</span><div><b>{s.name}</b><small>{s.category} · {s.address}</small></div><i>{isAdded ? "추가됨" : "＋"}</i></button>;
        })}</div>
      </section>
      {isDragging && pointerPosition && draggedSpot && <div className="touch-drag-preview" style={{ left: pointerPosition.x, top: pointerPosition.y }}><span>{draggedSpot.emoji}</span>{draggedSpot.name}</div>}
      <footer>하루여행 · 가볍게 떠나는 하루를 위해</footer>
    </main>
  );
}
