"use client";

import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window { kakao: any }
}

type Spot = { id: string; name: string; category: string; address: string; x: number; y: number; stay: number; emoji: string };

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

export default function Home() {
  const [city, setCity] = useState("성수동");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(["카페", "맛집", "산책"]);
  const [spots, setSpots] = useState<Spot[]>(sampleSpots);
  const [plan, setPlan] = useState<Spot[]>(sampleSpots);
  const [notice, setNotice] = useState("샘플 일정으로 체험 중이에요");
  const [mapReady, setMapReady] = useState(false);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem("haru-trip-plan");
    if (saved) setPlan(JSON.parse(saved));
    const key = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
    if (!key || !mapEl.current) return;
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services`;
    script.onload = () => window.kakao.maps.load(() => {
      if (!mapEl.current) return;
      mapRef.current = new window.kakao.maps.Map(mapEl.current, {
        center: new window.kakao.maps.LatLng(37.5444, 127.0447), level: 5,
      });
      setMapReady(true);
      setNotice("카카오맵이 연결됐어요");
    });
    document.head.appendChild(script);
    return () => script.remove();
  }, []);

  useEffect(() => {
    localStorage.setItem("haru-trip-plan", JSON.stringify(plan));
    if (!mapReady || !mapRef.current) return;
    const bounds = new window.kakao.maps.LatLngBounds();
    plan.forEach((spot, index) => {
      const pos = new window.kakao.maps.LatLng(spot.y, spot.x);
      bounds.extend(pos);
      const marker = new window.kakao.maps.Marker({ map: mapRef.current, position: pos, title: `${index + 1}. ${spot.name}` });
      marker.setMap(mapRef.current);
    });
    if (plan.length) mapRef.current.setBounds(bounds);
  }, [plan, mapReady]);

  const total = useMemo(() => plan.reduce((sum, s) => sum + s.stay, 0) + Math.max(0, plan.length - 1) * 18, [plan]);

  function searchPlaces(e: React.FormEvent) {
    e.preventDefault();
    const term = query.trim() || city;
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

  function generatePlan() {
    const pool = spots.filter(s => selected.some(c => s.category.includes(c)) || spots === sampleSpots);
    const ordered: Spot[] = [];
    const rest = [...(pool.length ? pool : spots)];
    while (rest.length && ordered.length < 4) {
      if (!ordered.length) ordered.push(rest.shift()!);
      else {
        const last = ordered[ordered.length - 1];
        rest.sort((a, b) => distance(last, a) - distance(last, b));
        ordered.push(rest.shift()!);
      }
    }
    setPlan(ordered); setNotice("가까운 장소끼리 묶어 하루 동선을 만들었어요");
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
          <div className="location-row"><input value={city} onChange={e => setCity(e.target.value)} aria-label="여행 지역"/><span>09:30 — 19:00</span></div>
          <label>오늘의 취향</label>
          <div className="chips">{categories.map(c => <button key={c} className={selected.includes(c) ? "active" : ""} onClick={() => setSelected(selected.includes(c) ? selected.filter(x => x !== c) : [...selected, c])}>{c}</button>)}</div>
          <button className="primary" onClick={generatePlan}>나만의 하루 만들기 <span>→</span></button>
        </div>
      </section>

      <section className="workspace">
        <div className="timeline-panel">
          <div className="section-head"><div><p>MY DAY</p><h2>{city}에서의 하루</h2></div><div className="summary"><b>{Math.floor(total / 60)}시간 {total % 60}분</b><span>{plan.length}개 장소</span></div></div>
          <div className="timeline">
            {plan.map((spot, i) => <article key={spot.id} className="stop">
              <div className="time">{`${String(10 + Math.floor(i * 2)).padStart(2,"0")}:${i % 2 ? "20" : "00"}`}</div>
              <div className="dot">{i + 1}</div>
              <div className="stop-card"><span className="emoji">{spot.emoji}</span><div><small>{spot.category}</small><h3>{spot.name}</h3><p>{spot.address}</p></div><button aria-label={`${spot.name} 삭제`} onClick={() => setPlan(plan.filter(p => p.id !== spot.id))}>×</button></div>
            </article>)}
          </div>
        </div>

        <div className="map-panel">
          <div ref={mapEl} className={`map ${mapReady ? "live" : ""}`}>
            {!mapReady && <><div className="road r1"/><div className="road r2"/><div className="river"/><div className="map-label">서울숲</div>{plan.map((s, i) => <div key={s.id} className={`pin p${i + 1}`}>{i + 1}</div>)}</>}
          </div>
          <div className="map-status"><span className={mapReady ? "connected" : ""}/>{notice}</div>
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
