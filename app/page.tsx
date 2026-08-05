"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";

declare global {
  interface Window { kakao: any }
}

type Spot = { id: string; name: string; category: string; address: string; x: number; y: number; stay: number; emoji: string; placeUrl?: string };
type ScheduleItem = { spot: Spot; start: string; end: string; travelToNext: number };

const sampleSpots: Spot[] = [
  { id: "1", name: "서울숲", category: "산책", address: "서울 성동구 뚝섬로 273", x: 127.0374, y: 37.5444, stay: 70, emoji: "🌳" },
  { id: "2", name: "성수연방", category: "문화공간", address: "서울 성동구 성수이로14길 14", x: 127.0570, y: 37.5414, stay: 60, emoji: "🧱" },
  { id: "3", name: "대림창고", category: "카페", address: "서울 성동구 성수이로 78", x: 127.0561, y: 37.5412, stay: 60, emoji: "☕" },
  { id: "4", name: "뚝도시장", category: "맛집", address: "서울 성동구 성덕정길 115", x: 127.0558, y: 37.5383, stay: 80, emoji: "🍜" },
];

const categories = ["카페", "맛집", "전시", "산책"];
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
  const [startTime, setStartTime] = useState("09:30");
  const [endTime, setEndTime] = useState("19:00");
  const [spots, setSpots] = useState<Spot[]>(sampleSpots);
  const [plan, setPlan] = useState<Spot[]>(sampleSpots);
  const [notice, setNotice] = useState("샘플 일정으로 체험 중이에요");
  const [mapReady, setMapReady] = useState(false);
  const [regionSuggestions, setRegionSuggestions] = useState<string[]>([]);
  const [isRegionSearching, setIsRegionSearching] = useState(false);
  const [showRegionSuggestions, setShowRegionSuggestions] = useState(false);
  const [isPlaceSearching, setIsPlaceSearching] = useState(false);
  const [searchNotice, setSearchNotice] = useState("지역과 장소 종류를 함께 검색해보세요");
  const [draggedSpot, setDraggedSpot] = useState<Spot | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlanAutoGenerated, setIsPlanAutoGenerated] = useState(true);
  const [activeDropIndex, setActiveDropIndex] = useState<number | null>(null);
  const [pointerPosition, setPointerPosition] = useState<{ x: number; y: number } | null>(null);
  const [routeOptimizeMessage, setRouteOptimizeMessage] = useState("");
  const mapEl = useRef<HTMLDivElement>(null);
  const timelineEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapObjectsRef = useRef<any[]>([]);
  const autoPlanCandidatesRef = useRef<Spot[]>(sampleSpots);
  const planningSettingsRef = useRef(`${startTime}|${endTime}|${selected.join(",")}`);
  const pointerDragRef = useRef<{ pointerId: number; spot: Spot } | null>(null);

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
    const settingsKey = `${startTime}|${endTime}|${selected.join(",")}`;
    if (planningSettingsRef.current === settingsKey) return;
    planningSettingsRef.current = settingsKey;
    if (!isPlanAutoGenerated || timeToMinutes(endTime) <= timeToMinutes(startTime)) return;
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
    let cursor = timeToMinutes(startTime);
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
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      setNotice("종료 시간을 시작 시간보다 늦게 설정해주세요");
      return;
    }
    if (!city.trim()) {
      setNotice("여행할 지역을 입력해주세요");
      return;
    }
    if (!selected.length) {
      setNotice("오늘의 취향을 하나 이상 골라주세요");
      return;
    }

    setNotice(`${city.trim()}의 장소를 찾고 있어요…`);
    const searches = await Promise.all(selected.map((preference) => fetchPlaces(`${city.trim()} ${preference}`, preference)));
    const unique = Array.from(new Map(searches.flat().map((spot) => [spot.id, spot])).values());
    if (!unique.length) {
      setNotice(`${city.trim()}에서 선택한 취향의 장소를 찾지 못했어요`);
      return;
    }
    setSpots(unique);
    const pool = unique.filter((spot) => selected.some((preference) => matchesPreference(spot, preference)));
    const candidates = pool.length ? pool : unique;
    const ordered = fitSpotsToTime(candidates, startTime, endTime);
    autoPlanCandidatesRef.current = unique;
    setIsPlanAutoGenerated(true);
    setPlan(ordered); setNotice(`${city.trim()}의 실제 장소 ${unique.length}곳에서 하루 동선을 만들었어요`);
  }

  function addSpot(spot: Spot) {
    if (plan.some(p => p.id === spot.id)) {
      setSearchNotice(`${spot.name}은 이미 일정에 있어요`);
      return;
    }
    setIsPlanAutoGenerated(false);
    const nextPlan = [...plan, spot];
    setPlan(nextPlan);
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
    setIsPlanAutoGenerated(false);
    setPlan(optimized);
    setNotice(`동선을 정리해 예상 도보시간을 약 ${savedMinutes}분 줄였어요`);
    setRouteOptimizeMessage(`${savedMinutes}분 단축 완료`);
  }

  function handleDragStart(event: DragEvent, spot: Spot) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", spot.id);
    setDraggedSpot(spot);
    setIsDragging(true);
    if (!plan.some(item => item.id === spot.id)) {
      window.requestAnimationFrame(() => timelineEl.current?.scrollIntoView({ behavior: "auto", block: "center" }));
    }
  }

  function handleDropAt(index: number) {
    if (!draggedSpot) return;
    const previousIndex = plan.findIndex(item => item.id === draggedSpot.id);
    const nextPlan = plan.filter(item => item.id !== draggedSpot.id);
    const adjustedIndex = previousIndex >= 0 && previousIndex < index ? index - 1 : index;
    nextPlan.splice(Math.max(0, Math.min(adjustedIndex, nextPlan.length)), 0, draggedSpot);
    setIsPlanAutoGenerated(false);
    setPlan(nextPlan);
    setSearchNotice(`${draggedSpot.name}의 일정 위치를 변경했어요`);
    setDraggedSpot(null);
    setIsDragging(false);
    setActiveDropIndex(null);
    setPointerPosition(null);
  }

  function handleDragEnd() {
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
    setActiveDropIndex(dropTarget ? Number(dropTarget.dataset.dropIndex) : null);
    if (event.clientY < 90) window.scrollBy(0, -24);
    if (event.clientY > window.innerHeight - 90) window.scrollBy(0, 24);
  }

  function handlePointerDragEnd(event: ReactPointerEvent<HTMLElement>) {
    if (pointerDragRef.current?.pointerId !== event.pointerId) return;
    const dropIndex = activeDropIndex;
    pointerDragRef.current = null;
    if (dropIndex !== null) handleDropAt(dropIndex);
    else handleDragEnd();
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span>하루</span>여행 <small>하루가 가벼워지는 여행 플래너</small></div>
        <button className="ghost" onClick={() => navigator.clipboard?.writeText(location.href)}>일정 공유</button>
      </header>

      <section className="hero">
        <div><p className="eyebrow">ONE DAY, ONE PERFECT ROUTE</p><h1>오늘 어디로<br/><em>떠나볼까요?</em></h1><p>취향과 시간을 고르면, 걷기 좋은 순서로 하루를 정리해드려요.</p></div>
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
            <div className="time-range">
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} aria-label="시작 시간"/>
              <span>—</span>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} aria-label="종료 시간"/>
            </div>
          </div>
          <label>오늘의 취향</label>
          <div className="chips">{categories.map(c => <button key={c} className={selected.includes(c) ? "active" : ""} onClick={() => setSelected(selected.includes(c) ? selected.filter(x => x !== c) : [...selected, c])}>{c}</button>)}</div>
          <button className="primary" onClick={generatePlan}>나만의 하루 만들기 <span>→</span></button>
        </div>
      </section>

      <section className="workspace">
        <div className="timeline-panel">
          <div className="section-head"><div><p>MY DAY</p><h2>{city}에서의 하루</h2></div><div className="section-tools"><div className="summary"><b>{Math.floor(total / 60)}시간 {total % 60}분</b><span>{plan.length}개 장소 · 도보 {totalTravel}분</span></div><div className="route-optimize-wrap"><button type="button" className="route-optimize" onClick={handleOptimizeRoute}>↗ 동선 정리</button><span role="status">{routeOptimizeMessage}</span></div></div></div>
          <div ref={timelineEl} className={`timeline ${isDragging ? "dragging" : ""}`}>
            {plan.length === 0 && <div className={`empty-drop-zone ${activeDropIndex === 0 ? "active" : ""}`} data-drop-index="0" onDragOver={event => event.preventDefault()} onDragEnter={() => setActiveDropIndex(0)} onDrop={() => handleDropAt(0)}>
              <b>{isDragging ? "여기에 놓으세요" : "아직 일정이 비어 있어요"}</b>
              <span>아래 검색 결과를 끌어오거나 눌러서 첫 장소를 추가하세요.</span>
            </div>}
            {schedule.map(({ spot, start, end, travelToNext }, i) => <Fragment key={spot.id}>
              <div className={`drop-zone ${activeDropIndex === i ? "active" : ""}`} data-drop-index={i} onDragOver={event => event.preventDefault()} onDragEnter={() => setActiveDropIndex(i)} onDrop={() => handleDropAt(i)}><span>{i === 0 ? "맨 앞에 놓기" : "여기에 놓기"}</span></div>
              <article className={`stop ${i === schedule.length - 1 ? "last" : ""}`} draggable onDragStart={event => handleDragStart(event, spot)} onDragEnd={handleDragEnd} aria-label={`${spot.name} 일정 순서 이동`}>
                <div className="time"><b>{start}</b><span>{end}</span></div>
                <div className="dot">{i + 1}</div>
                <div className="stop-card"><span className="drag-handle" role="button" aria-label={`${spot.name} 순서 이동`} tabIndex={0} onPointerDown={event => handlePointerDragStart(event, spot)} onPointerMove={handlePointerDragMove} onPointerUp={handlePointerDragEnd} onPointerCancel={handlePointerDragEnd}>⋮⋮</span><span className="emoji">{spot.emoji}</span><div><small>{spot.category} · 체류 {spot.stay}분</small><h3>{spot.name}</h3><p>{spot.address}</p><a className="kakao-review-link" href={kakaoPlaceUrl(spot)} target="_blank" rel="noopener noreferrer" draggable={false}>카카오맵 리뷰 ↗</a>{travelToNext > 0 && <p className="travel-meta">다음 장소까지 도보 약 {travelToNext}분</p>}</div><button aria-label={`${spot.name} 삭제`} onClick={() => { setIsPlanAutoGenerated(false); setPlan(plan.filter(p => p.id !== spot.id)); }}>×</button></div>
              </article>
            </Fragment>)}
            {plan.length > 0 && <div className={`drop-zone ${activeDropIndex === plan.length ? "active" : ""}`} data-drop-index={plan.length} onDragOver={event => event.preventDefault()} onDragEnter={() => setActiveDropIndex(plan.length)} onDrop={() => handleDropAt(plan.length)}><span>마지막에 놓기</span></div>}
          </div>
        </div>

        <div className="map-panel">
          <div ref={mapEl} className={`map ${mapReady ? "live" : ""}`}>
            {!mapReady && <><div className="road r1"/><div className="road r2"/><div className="river"/><div className="map-label">서울숲</div>{plan.map((s, i) => <div key={s.id} className={`pin p${i + 1}`}>{i + 1}</div>)}</>}
          </div>
          <div className="map-status"><span className={mapReady ? "connected" : ""}/>{notice}</div>
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
