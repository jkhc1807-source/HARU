"use client";

import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window { kakao: any }
}

type Spot = { id: string; name: string; category: string; address: string; x: number; y: number; stay: number; emoji: string };
type ScheduleItem = { spot: Spot; start: string; end: string; travelToNext: number };

const sampleSpots: Spot[] = [
  { id: "1", name: "서울숲", category: "산책", address: "서울 성동구 뚝섬로 273", x: 127.0374, y: 37.5444, stay: 70, emoji: "🌳" },
  { id: "2", name: "성수연방", category: "문화공간", address: "서울 성동구 성수이로14길 14", x: 127.0570, y: 37.5414, stay: 60, emoji: "🧱" },
  { id: "3", name: "대림창고", category: "카페", address: "서울 성동구 성수이로 78", x: 127.0561, y: 37.5412, stay: 60, emoji: "☕" },
  { id: "4", name: "뚝도시장", category: "맛집", address: "서울 성동구 성덕정길 115", x: 127.0558, y: 37.5383, stay: 80, emoji: "🍜" },
];

const categories = ["카페", "맛집", "전시", "산책"];

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
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapObjectsRef = useRef<any[]>([]);

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
    const term = `${city} ${query.trim()}`.trim();
    if (mapReady && window.kakao?.maps?.services) {
      const ps = new window.kakao.maps.services.Places();
      ps.keywordSearch(term, (data: any[], status: string) => {
        if (status !== window.kakao.maps.services.Status.OK) return setNotice("검색 결과가 없어요");
        const found = data.slice(0, 6).map((p: any, i: number): Spot => ({
          id: p.id, name: p.place_name, category: p.category_group_name || "장소", address: p.road_address_name || p.address_name,
          x: Number(p.x), y: Number(p.y), stay: 60, emoji: ["📍", "☕", "🍽️", "🎨"][i % 4],
        }));
        setSpots(found); setNotice(`‘${term}’ 실제 장소 ${found.length}곳을 찾았어요`);
      });
    } else {
      setSpots(sampleSpots.filter(s => `${s.name} ${s.category}`.includes(term) || term.includes("성수")));
      setNotice("키를 추가하면 카카오의 실제 검색 결과가 표시돼요");
    }
  }

  function fetchPlaces(term: string): Promise<Spot[]> {
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
          emoji: p.category_group_code === "CE7" ? "☕" : p.category_group_code === "FD6" ? "🍽️" : "📍",
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
    const searches = await Promise.all(selected.map((preference) => fetchPlaces(`${city.trim()} ${preference}`)));
    const unique = Array.from(new Map(searches.flat().map((spot) => [spot.id, spot])).values());
    if (!unique.length) {
      setNotice(`${city.trim()}에서 선택한 취향의 장소를 찾지 못했어요`);
      return;
    }
    setSpots(unique);
    const pool = unique.filter((spot) => selected.some((preference) => matchesPreference(spot, preference)));
    const ordered: Spot[] = [];
    const rest = [...(pool.length ? pool : unique)];
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
    setPlan(ordered); setNotice(`${city.trim()}의 실제 장소 ${unique.length}곳에서 하루 동선을 만들었어요`);
  }

  function addSpot(spot: Spot) {
    if (!plan.some(p => p.id === spot.id)) setPlan([...plan, spot]);
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
            <input value={city} onChange={e => setCity(e.target.value)} aria-label="여행 지역"/>
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
          <div className="section-head"><div><p>MY DAY</p><h2>{city}에서의 하루</h2></div><div className="summary"><b>{Math.floor(total / 60)}시간 {total % 60}분</b><span>{plan.length}개 장소 · 도보 {totalTravel}분</span></div></div>
          <div className="timeline">
            {schedule.map(({ spot, start, end, travelToNext }, i) => <article key={spot.id} className="stop">
              <div className="time"><b>{start}</b><span>{end}</span></div>
              <div className="dot">{i + 1}</div>
              <div className="stop-card"><span className="emoji">{spot.emoji}</span><div><small>{spot.category} · 체류 {spot.stay}분</small><h3>{spot.name}</h3><p>{spot.address}</p>{travelToNext > 0 && <p className="travel-meta">다음 장소까지 도보 약 {travelToNext}분</p>}</div><button aria-label={`${spot.name} 삭제`} onClick={() => setPlan(plan.filter(p => p.id !== spot.id))}>×</button></div>
            </article>)}
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
        <form onSubmit={searchPlaces}><input value={query} onChange={e => setQuery(e.target.value)} placeholder="카페, 전시관, 맛집을 검색해보세요"/><button>검색</button></form>
        <div className="results">{spots.map(s => <button className="result" key={s.id} onClick={() => addSpot(s)}><span>{s.emoji}</span><div><b>{s.name}</b><small>{s.category} · {s.address}</small></div><i>＋</i></button>)}</div>
      </section>
      <footer>하루여행 · 가볍게 떠나는 하루를 위해</footer>
    </main>
  );
}
