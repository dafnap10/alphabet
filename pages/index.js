import { useState, useEffect, useRef } from "react";
import Head from "next/head";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & HELPERS  (module-level — never recreated)
// ─────────────────────────────────────────────────────────────────────────────
const CATS  = ["Country","City","Animal","Food","Celebrity","Brand","Object"];
const ICONS = { Country:"🌍", City:"🏙️", Animal:"🦁", Food:"🍕", Celebrity:"⭐", Brand:"💼", Object:"📦" };
const LETTERS = "ABCDEFGHIJKLMNOPRSTW";

function makeId()       { return Math.random().toString(36).substring(2, 10); }
function pickLetter()   { return LETTERS[Math.floor(Math.random() * LETTERS.length)]; }
function score(v)       { return v ? Object.values(v).reduce((s,e) => s+(e?.valid?10:0), 0) : 0; }

async function apiPost(path, body) {
  const r = await fetch(path, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  const t = await r.text();
  if (!t) throw new Error(`Empty response from ${path} (${r.status})`);
  const j = JSON.parse(t);
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
}

async function apiGet(path) {
  const r = await fetch(path);
  const t = await r.text();
  if (!t) return null;
  const j = JSON.parse(t);
  if (!r.ok) return null;
  return j;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0a0a0f;--surf:#12121a;--surf2:#1c1c28;--brd:#2a2a3d;--acc:#e8ff47;--red:#ff4757;--txt:#f0f0ff;--mute:#6b6b8a;--ok:#2dff8a}
body{background:var(--bg);color:var(--txt);font-family:'DM Sans',sans-serif}
.G{min-height:100vh;display:flex;flex-direction:column;align-items:center;background:var(--bg);overflow-x:hidden}
.noise{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.35;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")}
.S{position:relative;z-index:1;width:100%;max-width:480px;padding:0 16px}
.home{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh}
.logo{text-align:center;margin-bottom:48px}
.lbadge{display:inline-block;background:var(--acc);color:#0a0a0f;font-family:'Bebas Neue',sans-serif;font-size:11px;letter-spacing:3px;padding:4px 10px;margin-bottom:12px}
.ltitle{font-family:'Bebas Neue',sans-serif;font-size:clamp(64px,18vw,96px);line-height:.9;letter-spacing:-2px;background:linear-gradient(135deg,#f0f0ff 30%,var(--acc) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.lsub{color:var(--mute);font-size:14px;margin-top:8px;letter-spacing:1px}
.menu{display:flex;flex-direction:column;gap:12px;width:100%}
.btn{border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;font-size:16px;transition:all .15s;border-radius:4px;padding:16px 24px;display:flex;align-items:center;gap:12px;justify-content:center}
.btn:active{transform:scale(.97)}
.btn-p{background:var(--acc);color:#0a0a0f;box-shadow:0 0 30px rgba(232,255,71,.25)}
.btn-p:hover{background:#d4eb2e}
.btn-p:disabled{opacity:.5;cursor:not-allowed;transform:none}
.btn-o{background:transparent;color:var(--txt);border:1px solid var(--brd)}
.btn-o:hover{border-color:var(--acc);color:var(--acc)}
.btn-g{background:var(--surf2);color:var(--txt)}
.btn-g:hover{background:var(--brd)}
.bico{font-size:20px}
.back{background:none;border:none;color:var(--mute);cursor:pointer;font-family:'DM Sans',sans-serif;font-size:14px;display:flex;align-items:center;gap:6px;padding:4px 0}
.back:hover{color:var(--txt)}
.ghdr{padding:16px 0;display:flex;align-items:center;justify-content:space-between}
.ldisplay{text-align:center;padding:24px 0 16px;position:relative}
.lbg{font-family:'Bebas Neue',sans-serif;font-size:180px;line-height:1;color:transparent;-webkit-text-stroke:2px rgba(232,255,71,.15);position:absolute;left:50%;transform:translateX(-50%);top:-20px;user-select:none;pointer-events:none}
.lmain{font-family:'Bebas Neue',sans-serif;font-size:96px;line-height:1;color:var(--acc);filter:drop-shadow(0 0 30px rgba(232,255,71,.5));position:relative;z-index:1}
.llbl{color:var(--mute);font-size:12px;letter-spacing:3px;margin-top:4px}
.tbar-wrap{height:4px;background:var(--surf2);border-radius:2px;margin:16px 0;overflow:hidden}
.tbar{height:100%;border-radius:2px;transition:width 1s linear,background 1s}
.tnum{font-family:'Bebas Neue',sans-serif;font-size:48px;text-align:center;letter-spacing:2px;transition:color .5s}
.cats{display:flex;flex-direction:column;gap:8px;margin:16px 0}
.crow{display:flex;align-items:center;gap:12px;background:var(--surf);border:1px solid var(--brd);border-radius:8px;padding:10px 14px;transition:border-color .2s}
.crow:focus-within{border-color:var(--acc);box-shadow:0 0 0 2px rgba(232,255,71,.1)}
.crow.bad{border-color:var(--red)}
.cico{font-size:20px;width:28px;text-align:center;flex-shrink:0}
.clbl{font-size:11px;color:var(--mute);width:64px;flex-shrink:0;letter-spacing:.5px;font-weight:500}
.cinp{flex:1;background:transparent;border:none;outline:none;color:var(--txt);font-family:'DM Sans',sans-serif;font-size:16px;font-weight:500}
.cinp::placeholder{color:var(--mute);font-weight:300}
.cinp:disabled{opacity:.5;cursor:not-allowed}
.cx{font-size:13px;min-width:16px;text-align:center}
.vwrap{display:flex;flex-direction:column;align-items:center;gap:16px;padding:40px 16px;text-align:center}
.aibadge{display:inline-flex;align-items:center;gap:8px;background:rgba(232,255,71,.1);border:1px solid rgba(232,255,71,.3);border-radius:20px;padding:6px 14px;font-size:13px;color:var(--acc);font-weight:500}
.aidot{width:8px;height:8px;border-radius:50%;background:var(--acc);animation:blink 1s infinite;flex-shrink:0}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
.spin{width:40px;height:40px;border:3px solid var(--brd);border-top-color:var(--acc);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.sscrn{display:flex;flex-direction:column;align-items:center;padding:32px 0;gap:20px}
.sbig{font-family:'Bebas Neue',sans-serif;font-size:120px;line-height:1;color:var(--acc);filter:drop-shadow(0 0 40px rgba(232,255,71,.6));animation:pop .5s cubic-bezier(.34,1.56,.64,1)}
@keyframes pop{from{transform:scale(.3) rotate(-10deg);opacity:0}to{transform:scale(1);opacity:1}}
.slbl{color:var(--mute);letter-spacing:3px;font-size:12px}
.smax{color:var(--mute);font-size:14px}
.rlist{width:100%;display:flex;flex-direction:column;gap:6px}
.rrow{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-radius:8px;background:var(--surf);border-left:3px solid transparent}
.rrow.rv{border-left-color:var(--ok)}
.rrow.ri{border-left-color:var(--red);opacity:.8}
.rico{font-size:17px;width:22px;text-align:center;flex-shrink:0;padding-top:2px}
.rcat{font-size:11px;color:var(--mute);width:62px;flex-shrink:0;padding-top:3px}
.rbody{flex:1;min-width:0}
.rans{font-weight:500;font-size:15px}
.rwhy{font-size:11px;color:var(--mute);margin-top:2px;font-style:italic}
.rpts{font-family:'Bebas Neue',sans-serif;font-size:20px;flex-shrink:0}
.pt-ok{color:var(--ok)}.pt-no{color:var(--red)}
.oscr{display:flex;flex-direction:column;min-height:100vh;padding-top:24px;gap:20px}
.stitle{font-family:'Bebas Neue',sans-serif;font-size:36px;letter-spacing:1px}
.flbl{font-size:12px;color:var(--mute);letter-spacing:2px;font-weight:500}
.tinp{background:var(--surf);border:1px solid var(--brd);border-radius:8px;padding:14px 16px;color:var(--txt);font-family:'DM Sans',sans-serif;font-size:16px;font-weight:500;width:100%;outline:none;transition:border-color .2s}
.tinp:focus{border-color:var(--acc)}
.err{color:var(--red);font-size:13px;text-align:center;padding:8px;background:rgba(255,71,87,.1);border-radius:6px}
.div{height:1px;background:var(--brd);margin:4px 0}
.mcard{background:var(--surf);border:1px solid var(--brd);border-radius:12px;padding:32px 24px;display:flex;flex-direction:column;align-items:center;gap:20px;text-align:center}
.mcard-title{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:1px}
.mstatus{font-size:14px;color:var(--mute)}
.mfound{color:var(--ok);font-size:15px;font-weight:600}
.pulse-ring{width:80px;height:80px;border-radius:50%;border:3px solid var(--acc);position:relative;display:flex;align-items:center;justify-content:center}
.pulse-ring::after{content:'';position:absolute;inset:-8px;border-radius:50%;border:2px solid var(--acc);opacity:.4;animation:ring 1.5s ease-out infinite}
@keyframes ring{0%{transform:scale(1);opacity:.4}100%{transform:scale(1.4);opacity:0}}
.pulse-ico{font-size:32px}
.vsscrn{display:flex;flex-direction:column;gap:14px;padding:24px 0}
.vshdr{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;color:var(--mute);text-align:center}
.bnr{text-align:center;padding:16px;border-radius:8px}
.bnr-w{border:1px solid var(--acc);background:rgba(232,255,71,.1)}
.bnr-l{border:1px solid var(--red);background:rgba(255,71,87,.1)}
.bnr-t{border:1px solid var(--mute);background:rgba(107,107,138,.2)}
.btxt{font-family:'Bebas Neue',sans-serif;font-size:32px}
.bt-w{color:var(--acc)}.bt-l{color:var(--red)}.bt-t{color:var(--txt)}
.srow{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center}
.sside{text-align:center}
.sslbl{font-size:11px;color:var(--mute);letter-spacing:1px;margin-bottom:4px;font-weight:500}
.ssnum{font-family:'Bebas Neue',sans-serif;font-size:56px}
.sy{color:var(--acc)}.so{color:var(--red)}
.vsmid{font-family:'Bebas Neue',sans-serif;font-size:24px;color:var(--mute);text-align:center}
.cmp{display:flex;flex-direction:column;gap:6px}
.cmpr{display:grid;grid-template-columns:1fr 32px 1fr;gap:6px;align-items:flex-start}
.cmpc{padding:8px 10px;border-radius:6px;font-size:13px;font-weight:500;background:var(--surf);border:1px solid var(--brd);min-height:38px;display:flex;flex-direction:column;justify-content:center}
.cmpc.cw{border-color:var(--ok);background:rgba(45,255,138,.08)}
.cmpc.cl{opacity:.4}
.cmpw{font-size:10px;color:var(--mute);margin-top:2px;font-style:italic}
.cmpico{text-align:center;font-size:16px;padding-top:10px}
`;

// ─────────────────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  const [screen,      setScreen]      = useState("home");
  const [letter,      setLetter]      = useState("B");
  const [answers,     setAnswers]     = useState({});
  const [timeLeft,    setTimeLeft]    = useState(60);
  const [submitted,   setSubmitted]   = useState(false);
  const [validating,  setValidating]  = useState(false);
  const [validation,  setValidation]  = useState(null);
  const [playerName,  setPlayerName]  = useState("");
  const [oppName,     setOppName]     = useState("");
  const [oppAnswers,  setOppAnswers]  = useState({});
  const [oppVal,      setOppVal]      = useState(null);
  const [error,       setError]       = useState("");
  const [queueStatus, setQueueStatus] = useState("searching");

  const timerRef   = useRef(null);
  const pollRef    = useRef(null);
  const pollAnsRef = useRef(null);
  const answersR   = useRef({});
  const letterR    = useRef("B");
  const roomR      = useRef("");
  const nameR      = useRef("");
  const myIdR      = useRef("");
  const submittedR = useRef(false);

  useEffect(() => { answersR.current   = answers;    }, [answers]);
  useEffect(() => { letterR.current    = letter;     }, [letter]);
  useEffect(() => { nameR.current      = playerName; }, [playerName]);
  useEffect(() => { submittedR.current = submitted;  }, [submitted]);

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);
    clearInterval(pollAnsRef.current);
  }, []);

  // ── Timer ──────────────────────────────────────────────────────────────────
  const DURATION = 60;
  function startTimer(onEnd) {
    clearInterval(timerRef.current);
    setTimeLeft(DURATION);
    setSubmitted(false);
    setValidation(null);
    setValidating(false);
    submittedR.current = false;
    let t = DURATION;
    timerRef.current = setInterval(() => {
      t--;
      setTimeLeft(t);
      if (t <= 0) { clearInterval(timerRef.current); onEnd(); }
    }, 1000);
  }

  // ── Submit + validate ──────────────────────────────────────────────────────
  async function doSubmit(l, roomId) {
    if (submittedR.current) return;
    clearInterval(timerRef.current);
    submittedR.current = true;
    setSubmitted(true);
    setValidating(true);

    let result;
    try {
      result = await apiPost("/api/validate", { answers: answersR.current, letter: l });
    } catch {
      // fallback
      result = {};
      CATS.forEach(c => {
        const v = (answersR.current[c]||"").trim();
        const ok = v.length >= 2 && v.toLowerCase().startsWith(l.toLowerCase());
        result[c] = { valid: ok, reason: ok ? "Valid" : "Invalid or empty" };
      });
    }

    setValidation(result);
    setValidating(false);

    if (roomId) {
      try {
        await apiPost("/api/room", { id: roomId, playerName: nameR.current, answers: answersR.current, validation: result });
      } catch(e) { console.error("save answers:", e); }
    } else {
      setScreen("solo-score");
    }
  }

  // ── Solo ───────────────────────────────────────────────────────────────────
  function startSolo() {
    const l = pickLetter();
    setLetter(l); letterR.current = l;
    setAnswers({}); answersR.current = {};
    setScreen("solo-game");
    startTimer(() => doSubmit(l, null));
  }

  // ── Matchmaking ────────────────────────────────────────────────────────────
  async function findMatch() {
    if (!playerName.trim()) return setError("Enter your name first");
    setError("");
    const myId = makeId();
    myIdR.current = myId;
    setQueueStatus("searching");
    setScreen("matchmaking");

    try {
      const result = await apiPost("/api/matchmake", { playerId: myId, playerName });
      if (result.matched) {
        launchGame(result.room, result.opponentName);
      } else {
        // Poll — each poll also actively tries to match
        pollRef.current = setInterval(async () => {
          try {
            const ps = await apiGet(`/api/match-status?playerId=${myId}`);
            if (ps?.matched && ps.room) {
              clearInterval(pollRef.current);
              const opp = (ps.room.players || []).find(p => p !== nameR.current) || "Opponent";
              setQueueStatus("found");
              setTimeout(() => launchGame(ps.room, opp), 800);
            }
          } catch { /* keep polling */ }
        }, 2000);
      }
    } catch (e) {
      setScreen("online-name");
      setError("Matchmaking failed: " + e.message);
    }
  }

  function launchGame(room, opponentName) {
    roomR.current = room.id;
    setOppName(opponentName);
    const l = room.letter;
    setLetter(l); letterR.current = l;
    setAnswers({}); answersR.current = {};
    setScreen("online-game");
    startTimer(() => doSubmit(l, room.id));
  }

  async function cancelMatchmaking() {
    clearInterval(pollRef.current);
    try { await apiPost("/api/leave-queue", { playerId: myIdR.current }); } catch {}
    setScreen("online-name");
  }

  // ── Poll for opponent results after submitting ─────────────────────────────
  useEffect(() => {
    if (screen !== "online-game" || !submitted || validating) return;
    const roomId = roomR.current;
    clearInterval(pollAnsRef.current);
    pollAnsRef.current = setInterval(async () => {
      try {
        const room = await apiGet(`/api/room?id=${roomId}`);
        if (!room) return;
        const opp = (room.players || []).find(p => p !== nameR.current);
        if (opp && room.answers?.[opp] && room.validation?.[opp]) {
          clearInterval(pollAnsRef.current);
          setOppAnswers(room.answers[opp]);
          setOppVal(room.validation[opp]);
          setScreen("online-score");
        }
      } catch { /* keep polling */ }
    }, 2000);
    return () => clearInterval(pollAnsRef.current);
  }, [screen, submitted, validating]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const pct   = (timeLeft / DURATION) * 100;
  const tcol  = timeLeft > 20 ? "var(--ok)" : timeLeft > 10 ? "var(--acc)" : "var(--red)";
  const myPts = score(validation);
  const opPts = score(oppVal);

  function setAns(cat, val) { setAnswers(p => ({ ...p, [cat]: val })); }

  // ─────────────────────────────────────────────────────────────────────────
  // SCREENS
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === "home") return (
    <div className="G"><div className="noise"/>
      <div className="S">
        <div className="home">
          <div className="logo">
            <div className="lbadge">AI-JUDGED WORD GAME</div>
            <div className="ltitle">ALPHABET<br/>GAME</div>
            <div className="lsub">Fill categories. Beat the clock. Win.</div>
          </div>
          <div className="menu">
            <button className="btn btn-p" onClick={() => setScreen("solo-name")}><span className="bico">🎮</span> Play Solo</button>
            <button className="btn btn-o" onClick={() => { setError(""); setScreen("online-name"); }}><span className="bico">🌐</span> Play Online</button>
          </div>
        </div>
      </div>
    </div>
  );

  if (screen === "solo-name") return (
    <div className="G"><div className="noise"/>
      <div className="S">
        <div className="oscr">
          <button className="back" onClick={() => setScreen("home")}>← Back</button>
          <div className="stitle">Solo Play</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div className="flbl">YOUR NAME</div>
            <input className="tinp" placeholder="Enter your name…" value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => e.key==="Enter" && playerName.trim() && startSolo()} />
          </div>
          <button className="btn btn-p" onClick={startSolo} disabled={!playerName.trim()}><span className="bico">🚀</span> Start Game</button>
        </div>
      </div>
    </div>
  );

  if (screen === "online-name") return (
    <div className="G"><div className="noise"/>
      <div className="S">
        <div className="oscr">
          <button className="back" onClick={() => setScreen("home")}>← Back</button>
          <div className="stitle">Play Online</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div className="flbl">YOUR NAME</div>
            <input className="tinp" placeholder="Enter your name…" value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => e.key==="Enter" && playerName.trim() && findMatch()} />
          </div>
          {error && <div className="err">{error}</div>}
          <button className="btn btn-p" onClick={findMatch} disabled={!playerName.trim()}><span className="bico">🔍</span> Find Match</button>
        </div>
      </div>
    </div>
  );

  if (screen === "matchmaking") return (
    <div className="G"><div className="noise"/>
      <div className="S">
        <div className="oscr">
          <div className="stitle">Matchmaking</div>
          <div className="mcard">
            {queueStatus === "found" ? (
              <><div style={{fontSize:48}}>🎮</div><div className="mfound">Opponent found!</div><div className="mstatus">Starting game…</div></>
            ) : (
              <><div className="pulse-ring"><span className="pulse-ico">🔍</span></div>
              <div className="mcard-title">Finding a Match</div>
              <div className="mstatus">Looking for an opponent for <strong style={{color:"var(--txt)"}}>{playerName}</strong>…</div>
              <div className="spin" style={{width:24,height:24,borderWidth:2}}/></>
            )}
          </div>
          {queueStatus !== "found" && <button className="btn btn-g" onClick={cancelMatchmaking}>Cancel</button>}
        </div>
      </div>
    </div>
  );

  // ── SOLO GAME — inputs inlined directly, no sub-component ─────────────────
  if (screen === "solo-game") return (
    <div className="G"><div className="noise"/>
      <div className="S">
        <div className="ghdr">
          <button className="back" onClick={() => { clearInterval(timerRef.current); setScreen("home"); }}>← Quit</button>
          <span style={{fontSize:13,color:"var(--mute)"}}>{playerName}</span>
        </div>
        <div className="ldisplay">
          <div className="lbg">{letter}</div>
          <div className="lmain">{letter}</div>
          <div className="llbl">CURRENT LETTER</div>
        </div>
        <div className="tbar-wrap"><div className="tbar" style={{width:`${pct}%`,background:tcol}}/></div>
        <div className="tnum" style={{color:tcol}}>{String(timeLeft).padStart(2,"0")}</div>
        {validating ? (
          <div className="vwrap">
            <div className="spin"/>
            <div className="aibadge"><div className="aidot"/> AI is judging your answers…</div>
          </div>
        ) : (
          <>
            <div className="cats">
              {CATS.map(cat => {
                const val = answers[cat] || "";
                const bad = val.length >= 1 && !val.toLowerCase().startsWith(letter.toLowerCase());
                return (
                  <div key={cat} className={`crow${bad?" bad":""}`}>
                    <span className="cico">{ICONS[cat]}</span>
                    <span className="clbl">{cat}</span>
                    <input className="cinp" placeholder={`${letter}…`}
                      value={val} onChange={e => setAns(cat, e.target.value)}
                      disabled={submitted} autoComplete="off" />
                    <span className="cx">{bad?"❌":""}</span>
                  </div>
                );
              })}
            </div>
            {!submitted && (
              <button className="btn btn-p" style={{width:"100%",marginTop:8,marginBottom:24}}
                onClick={() => doSubmit(letter, null)}>Submit Answers</button>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (screen === "solo-score") return (
    <div className="G"><div className="noise"/>
      <div className="S">
        <div className="sscrn">
          <div className="slbl">YOUR SCORE</div>
          <div className="sbig">{myPts}</div>
          <div className="smax">out of {CATS.length * 10} · letter {letter}</div>
          <div className="aibadge" style={{fontSize:12}}><div className="aidot"/> AI-validated</div>
          <div className="div" style={{width:"100%"}}/>
          <div className="rlist" style={{width:"100%"}}>
            {CATS.map(cat => {
              const val = answers[cat] || "";
              const v = validation?.[cat];
              const ok = v?.valid ?? false;
              return (
                <div key={cat} className={`rrow ${ok?"rv":"ri"}`}>
                  <span className="rico">{ICONS[cat]}</span>
                  <span className="rcat">{cat}</span>
                  <div className="rbody">
                    <div className="rans">{val || <span style={{color:"var(--mute)",fontSize:13}}>—</span>}</div>
                    {v?.reason && v.reason !== "empty" && <div className="rwhy">{v.reason}</div>}
                  </div>
                  <span className={`rpts ${ok?"pt-ok":"pt-no"}`}>{ok?"+10":"0"}</span>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:10,width:"100%"}}>
            <button className="btn btn-p" style={{flex:1}} onClick={startSolo}>Play Again</button>
            <button className="btn btn-g" style={{flex:1}} onClick={() => setScreen("home")}>Home</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── ONLINE GAME — inputs inlined directly, no sub-component ───────────────
  if (screen === "online-game") return (
    <div className="G"><div className="noise"/>
      <div className="S">
        <div className="ghdr">
          <button className="back" onClick={() => { clearInterval(timerRef.current); setScreen("home"); }}>← Quit</button>
          <span style={{fontSize:13,color:"var(--mute)"}}>vs {oppName}</span>
        </div>
        <div className="ldisplay">
          <div className="lbg">{letter}</div>
          <div className="lmain">{letter}</div>
          <div className="llbl">CURRENT LETTER</div>
        </div>
        <div className="tbar-wrap"><div className="tbar" style={{width:`${pct}%`,background:tcol}}/></div>
        <div className="tnum" style={{color:tcol}}>{String(timeLeft).padStart(2,"0")}</div>
        {validating ? (
          <div className="vwrap">
            <div className="spin"/>
            <div className="aibadge"><div className="aidot"/> AI is judging your answers…</div>
            <div style={{color:"var(--mute)",fontSize:13}}>Also waiting for {oppName}…</div>
          </div>
        ) : submitted ? (
          <div style={{textAlign:"center",padding:"24px 12px",color:"var(--ok)",fontSize:14}}>
            ✓ Submitted — waiting for {oppName}…
            <div className="spin" style={{margin:"16px auto 0",width:32,height:32,borderWidth:2}}/>
          </div>
        ) : (
          <>
            <div className="cats">
              {CATS.map(cat => {
                const val = answers[cat] || "";
                const bad = val.length >= 1 && !val.toLowerCase().startsWith(letter.toLowerCase());
                return (
                  <div key={cat} className={`crow${bad?" bad":""}`}>
                    <span className="cico">{ICONS[cat]}</span>
                    <span className="clbl">{cat}</span>
                    <input className="cinp" placeholder={`${letter}…`}
                      value={val} onChange={e => setAns(cat, e.target.value)}
                      autoComplete="off" />
                    <span className="cx">{bad?"❌":""}</span>
                  </div>
                );
              })}
            </div>
            <button className="btn btn-p" style={{width:"100%",marginTop:8,marginBottom:24}}
              onClick={() => doSubmit(letterR.current, roomR.current)}>Submit Answers</button>
          </>
        )}
      </div>
    </div>
  );

  if (screen === "online-score") {
    const won = myPts > opPts, tie = myPts === opPts;
    return (
      <div className="G"><div className="noise"/>
        <div className="S">
          <div className="vsscrn">
            <div className="vshdr">RESULTS · {letter}</div>
            <div className={`bnr ${won?"bnr-w":tie?"bnr-t":"bnr-l"}`}>
              <div className={`btxt ${won?"bt-w":tie?"bt-t":"bt-l"}`}>
                {won?"🏆 YOU WIN!":tie?"🤝 IT'S A TIE!":"😤 YOU LOSE"}
              </div>
            </div>
            <div className="srow">
              <div className="sside"><div className="sslbl">{playerName.toUpperCase()}</div><div className="ssnum sy">{myPts}</div></div>
              <div className="vsmid">VS</div>
              <div className="sside"><div className="sslbl">{oppName.toUpperCase()}</div><div className="ssnum so">{opPts}</div></div>
            </div>
            <div className="div"/>
            <div className="aibadge" style={{alignSelf:"center",fontSize:12}}><div className="aidot"/> AI-validated</div>
            <div className="cmp">
              {CATS.map(cat => {
                const ma=answers[cat]||"", oa=oppAnswers[cat]||"";
                const mv=validation?.[cat], ov=oppVal?.[cat];
                const mp=mv?.valid?10:0, op2=ov?.valid?10:0;
                return (
                  <div key={cat} className="cmpr">
                    <div className={`cmpc ${mp>op2?"cw":mp<op2?"cl":""}`}>
                      <div>{ma||<span style={{color:"var(--mute)",fontSize:12}}>—</span>}</div>
                      {mv?.reason&&ma&&<div className="cmpw">{mv.reason}</div>}
                    </div>
                    <div className="cmpico">{ICONS[cat]}</div>
                    <div className={`cmpc ${op2>mp?"cw":op2<mp?"cl":""}`} style={{textAlign:"right",alignItems:"flex-end"}}>
                      <div>{oa||<span style={{color:"var(--mute)",fontSize:12}}>—</span>}</div>
                      {ov?.reason&&oa&&<div className="cmpw">{ov.reason}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:10,paddingBottom:24}}>
              <button className="btn btn-p" style={{flex:1}} onClick={() => setScreen("online-name")}>Play Again</button>
              <button className="btn btn-g" style={{flex:1}} onClick={() => setScreen("home")}>Home</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
