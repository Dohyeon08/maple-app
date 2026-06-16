import { useState, useRef, useCallback } from "react";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const rndKorean = () =>
  String.fromCharCode(Math.floor(Math.random() * (0xd7a3 - 0xac00 + 1)) + 0xac00);

const rndKoreanNoBatchim = () => {
  const cho = Math.floor(Math.random() * 19);
  const jung = Math.floor(Math.random() * 21);
  const jong = 0;
  const code = 0xac00 + (cho * 21 + jung) * 28 + jong;
  return String.fromCharCode(code);
};

const rndEngLower = () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
const rndEngUpper = () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];

function rndChar(type, noBatchim = false) {
  if (type === "english") {
    return Math.random() < 0.5 ? rndEngLower() : rndEngUpper();
  }

  if (type === "korean") {
    return noBatchim ? rndKoreanNoBatchim() : rndKorean();
  }

  return Math.random() < 0.65
    ? (noBatchim ? rndKoreanNoBatchim() : rndKorean())
    : (Math.random() < 0.5 ? rndEngLower() : rndEngUpper());
}

function buildName({ length, type, keyword, position, noBatchim }) {
  const kw = keyword || "";
  const kwLen = [...kw].length;
  const totalLen = Math.max(length, kwLen);
  const randLen = totalLen - kwLen;

  let randChars = "";
  for (let i = 0; i < randLen; i++) {
    randChars += rndChar(type, noBatchim);
  }

  if (!kw) return randChars;

  if (position === "front") return kw + randChars;
  if (position === "back") return randChars + kw;

  const insertIdx = Math.floor(Math.random() * (randLen + 1));
  return randChars.slice(0, insertIdx) + kw + randChars.slice(insertIdx);
}

async function apiCheck(name) {
  try {
    const res = await fetch(
      `https://maple-app-iota.vercel.app/api/check?name=${encodeURIComponent(name)}`
    );

    if (res.status === 200) return "taken";
    if (res.status === 404) return "available";

    const j = await res.json().catch(() => ({}));
    return "error:" + (j?.error?.message ?? `HTTP ${res.status}`);
  } catch (err) {
    const msg = (err.message || "").toLowerCase();
    if (msg.includes("cors") || msg.includes("failed to fetch") || msg.includes("network")) {
      return "cors";
    }
    return "error:" + err.message;
  }
}

const C = {
  bg: "#0D0A1F",
  panel: "#13113A",
  card: "#1A1845",
  cardBorder: "#252360",
  orange: "#FF7A1A",
  gold: "#FFD93D",
  green: "#35D463",
  red: "#FF4468",
  amber: "#FBBF24",
  muted: "#7B78B0",
  text: "#EBE8FF",
  sub: "#9390C0",
  divider: "#1F1D50",
};

function Pill({ color, children }) {
  return (
    <span
      style={{
        display: "inline-block",
        background: color + "22",
        border: `1px solid ${color}55`,
        color,
        fontSize: 11,
        fontWeight: 700,
        borderRadius: 6,
        padding: "2px 8px",
        letterSpacing: "0.5px",
      }}
    >
      {children}
    </span>
  );
}

function SliderRow({ label, value, min, max, accent, onChange }) {
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          color: C.muted,
          marginBottom: 7,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>{label}</span>
        <strong style={{ color: C.text }}>{value}자</strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={onChange}
        style={{ width: "100%", accentColor: accent || C.orange, height: 4, cursor: "pointer" }}
      />
    </div>
  );
}

const STYLE_TAG = `
@keyframes pulse-border { 0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); border-color: rgba(251,191,36,0.35); } 50% { box-shadow: 0 0 10px 2px rgba(251,191,36,0.25); border-color: rgba(251,191,36,0.85); } }
@keyframes float { 0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.6; } 50% { transform: translateY(-14px) rotate(10deg); opacity: 1; } }
@keyframes glow-green { 0%, 100% { box-shadow: 0 0 6px 0 rgba(53,212,99,0.2); } 50% { box-shadow: 0 0 16px 3px rgba(53,212,99,0.45); } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
.checking-card { animation: pulse-border 1.6s ease-in-out infinite; }
.available-card { animation: glow-green 2.5s ease-in-out infinite; }
.result-item { animation: fadeUp 0.3s ease-out forwards; }
.maple-float { animation: float 3s ease-in-out infinite; }
`;

export default function App() {
  const [cfg, setCfg] = useState({
    length: 5,
    type: "korean",
    keyword: "",
    position: "front",
    count: 5,
    noBatchim: false,
  });

  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(null);
  const [progress, setProgress] = useState(0);

  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);

  const abortRef = useRef(false);

  const set = (k) => (v) => setCfg((p) => ({ ...p, [k]: v }));

  const generate = useCallback(async () => {
    abortRef.current = false;
    setBusy(true);
    setProgress(0);
    setItems([]);

    const results = [];
    const seen = new Set();
    const maxAttempts = cfg.count * 50;
    let attempts = 0;

    while (results.length < cfg.count && attempts < maxAttempts && !abortRef.current) {
      attempts++;
      const name = buildName(cfg);

      if (seen.has(name)) continue;
      seen.add(name);

      const status = await apiCheck(name);
      if (status === "available") {
        results.push({ id: results.length, name, status: "available" });
        setItems([...results]);
        setProgress(Math.round((results.length / cfg.count) * 100));
      }

      if (!abortRef.current && attempts < maxAttempts) {
        await sleep(180);
      }
    }

    setBusy(false);
  }, [cfg]);

  const stop = () => {
    abortRef.current = true;
    setBusy(false);
  };

  const doCopy = (text, id) =>
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });

  const checkNickname = async () => {
    const target = searchName.trim();
    if (!target) return;

    setSearching(true);
    setSearchResult(null);

    const result = await apiCheck(target);
    setSearchResult(result);
    setSearching(false);
  };

  const stats = {
    avail: items.filter((x) => x.status === "available").length,
  };

  const inp = {
    width: "100%",
    background: "#0D0A1F",
    border: `1px solid ${C.cardBorder}`,
    borderRadius: 10,
    padding: "10px 14px",
    color: C.text,
    fontSize: 14,
    boxSizing: "border-box",
    outline: "none",
    fontFamily: "inherit",
  };

  const typeBtn = (val, label) => (
    <button
      key={val}
      onClick={() => set("type")(val)}
      style={{
        flex: 1,
        padding: "10px 6px",
        borderRadius: 10,
        cursor: "pointer",
        border: `2px solid ${cfg.type === val ? C.orange : C.cardBorder}`,
        background: cfg.type === val ? `${C.orange}20` : "transparent",
        color: cfg.type === val ? C.orange : C.muted,
        fontWeight: cfg.type === val ? 800 : 400,
        fontSize: 13,
      }}
    >
      {label}
    </button>
  );

  const posBtn = (val, label) => (
    <button
      key={val}
      onClick={() => set("position")(val)}
      style={{
        flex: 1,
        padding: "10px 6px",
        borderRadius: 10,
        cursor: "pointer",
        border: `2px solid ${cfg.position === val ? C.gold : C.cardBorder}`,
        background: cfg.position === val ? `${C.gold}20` : "transparent",
        color: cfg.position === val ? C.gold : C.muted,
        fontWeight: cfg.position === val ? 800 : 400,
        fontSize: 13,
      }}
    >
      {label}
    </button>
  );

  return (
    <>
      <style>{STYLE_TAG}</style>

      <div style={{ position: "fixed", top: 18, right: 18, zIndex: 50 }}>
        <button
          onClick={() => setShowSearchPanel(true)}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: `1px solid ${C.cardBorder}`,
            background: `${C.card}E6`,
            color: C.text,
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
            backdropFilter: "blur(8px)",
          }}
        >
          🔎 닉네임 검사
        </button>
      </div>

      <div
        style={{
          minHeight: "100vh",
          background: `radial-gradient(ellipse at 50% 0%, #1A1050 0%, ${C.bg} 60%)`,
          color: C.text,
          fontFamily: "'Segoe UI', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
          padding: "32px 16px 60px",
          boxSizing: "border-box",
        }}
      >
        {showSearchPanel && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 60,
              background: "rgba(5, 4, 18, 0.72)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              boxSizing: "border-box",
            }}
            onClick={() => setShowSearchPanel(false)}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 520,
                background: C.panel,
                border: `1px solid ${C.cardBorder}`,
                borderRadius: 22,
                padding: 22,
                boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>닉네임 직접 검사</div>
                  <h3 style={{ margin: 0, color: C.gold, fontSize: 18 }}>사용 중인지 바로 확인하기</h3>
                </div>
                <button
                  onClick={() => setShowSearchPanel(false)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: C.muted,
                    fontSize: 22,
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <input
                  style={inp}
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") checkNickname();
                  }}
                  placeholder="검사할 닉네임 입력"
                  maxLength={12}
                />
                <button
                  onClick={checkNickname}
                  disabled={searching}
                  style={{
                    padding: "0 18px",
                    border: "none",
                    borderRadius: 10,
                    background: searching ? C.cardBorder : C.orange,
                    color: searching ? C.muted : "#000",
                    fontWeight: 800,
                    cursor: searching ? "not-allowed" : "pointer",
                    minWidth: 86,
                  }}
                >
                  {searching ? "검사중..." : "검사"}
                </button>
              </div>

              {searchResult && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 14,
                    borderRadius: 12,
                    background: C.card,
                    border: `1px solid ${C.cardBorder}`,
                    fontSize: 14,
                    fontWeight: 700,
                    color:
                      searchResult === "available"
                        ? C.green
                        : searchResult === "taken"
                          ? C.red
                          : C.amber,
                  }}
                >
                  {searchResult === "available" && "✅ 사용 가능한 닉네임입니다."}
                  {searchResult === "taken" && "❌ 이미 사용 중인 닉네임입니다."}
                  {searchResult === "cors" && "⚠️ 백엔드 서버(mapleserver.js)가 켜져 있는지 확인하세요."}
                  {typeof searchResult === "string" && searchResult.startsWith("error:") && `⚠️ ${searchResult.replace("error:", "")}`}
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div className="maple-float" style={{ fontSize: 60, lineHeight: 1, marginBottom: 12, display: "inline-block" }}>🍁</div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 900,
              margin: "0 0 8px 0",
              letterSpacing: "-0.5px",
              background: `linear-gradient(90deg, ${C.orange} 0%, ${C.gold} 60%, ${C.orange} 100%)`,
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            메이플스토리 닉네임 생성기
          </h1>
          <p style={{ color: C.sub, margin: 0, fontSize: 13 }}>
            넥슨 Open API 연동 · 실시간 중복 검사 · 사용 가능한 닉네임 자동 탐색
          </p>
        </div>

        <div style={{ maxWidth: 580, margin: "0 auto 24px", background: C.panel, border: `1px solid ${C.cardBorder}`, borderRadius: 22, padding: "26px 26px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
            <span style={{ fontSize: 16 }}>⚙️</span>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: C.gold }}>생성 조건 설정</h2>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>문자 종류</div>
            <div style={{ display: "flex", gap: 8 }}>
              {typeBtn("korean", "🇰🇷 한글")}
              {typeBtn("english", "🔤 영문")}
              {typeBtn("mixed", "🌀 혼합")}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <SliderRow label="닉네임 총 글자 수" value={cfg.length} min={2} max={12} onChange={(e) => set("length")(+e.target.value)} />
          </div>

          <div style={{ height: 1, background: C.divider, margin: "0 0 18px" }} />

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 7 }}>
              무조건 포함할 글자 <span style={{ color: C.cardBorder }}>(선택)</span>
            </div>
            <input
              style={inp}
              value={cfg.keyword}
              onChange={(e) => set("keyword")(e.target.value)}
              placeholder="예: 다크, 신, 킹, 잉"
              maxLength={6}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: C.text, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={cfg.noBatchim}
                onChange={(e) => set("noBatchim")(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: C.orange }}
              />
              받침 없는 한글만 생성
            </label>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
              지정한 글자는 그대로 유지되고, 랜덤 생성되는 한글만 받침이 제거됩니다.
            </div>
          </div>

          {cfg.keyword && (
            <div style={{ marginBottom: 24, animation: "fadeUp 0.2s ease-out" }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>글자 포함 위치 선택</div>
              <div style={{ display: "flex", gap: 8 }}>
                {posBtn("front", "⏮️ 맨 앞")}
                {posBtn("random", "🎲 랜덤 위치")}
                {posBtn("back", "⏭️ 맨 뒤")}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 7, display: "flex", justifyContent: "space-between" }}>
              <span>한 번에 생성할 개수</span>
              <strong style={{ color: C.text }}>{cfg.count}개</strong>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={cfg.count}
              onChange={(e) => set("count")(+e.target.value)}
              style={{ width: "100%", accentColor: C.orange, height: 4, cursor: "pointer" }}
            />
          </div>

          {busy && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ height: 4, background: C.cardBorder, borderRadius: 99, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${C.orange}, ${C.gold})`,
                    borderRadius: 99,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={generate}
              disabled={busy}
              style={{
                flex: 1,
                padding: "14px 0",
                border: "none",
                borderRadius: 12,
                background: busy ? C.cardBorder : `linear-gradient(90deg, ${C.orange} 0%, ${C.gold} 100%)`,
                color: busy ? C.muted : "#0C0A1F",
                fontWeight: 900,
                fontSize: 16,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "🔍 닉네임 검사 중..." : "🎲 닉네임 생성하기"}
            </button>
            {busy && (
              <button
                onClick={stop}
                style={{
                  padding: "14px 20px",
                  border: "none",
                  borderRadius: 12,
                  background: `${C.red}22`,
                  border: `1.5px solid ${C.red}`,
                  color: C.red,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                중지
              </button>
            )}
          </div>
        </div>

        {items.length > 0 && (
          <div style={{ maxWidth: 580, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <span style={{ fontSize: 13, color: C.green }}>
                  ✅ 사용 가능 <strong>{stats.avail}</strong>개
                </span>
              </div>
            </div>

            {items.map((item) => (
              <div
                key={item.id}
                className="result-item available-card"
                style={{
                  background: C.card,
                  border: `1.5px solid ${C.green}70`,
                  borderRadius: 16,
                  padding: "16px 20px",
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative", zIndex: 1 }}>
                  <span style={{ fontSize: 26 }}>✅</span>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: C.text, letterSpacing: "0.5px" }}>
                        {item.name}
                      </span>
                      <Pill color={C.green}>AVAILABLE</Pill>
                    </div>
                    <div style={{ color: C.green, fontSize: 12 }}>사용 가능!</div>
                  </div>
                </div>
                <button
                  onClick={() => doCopy(item.name, item.id)}
                  style={{
                    padding: "7px 18px",
                    borderRadius: 9,
                    border: `1.5px solid ${C.green}`,
                    background: copied === item.id ? C.green : `${C.green}15`,
                    color: copied === item.id ? "#0D0A1F" : C.green,
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {copied === item.id ? "✓ 복사됨!" : "복사"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
