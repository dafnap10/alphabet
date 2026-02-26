import { useState, useEffect, useRef } from "react";
import Head from "next/head";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const CATS    = ["Country","City","Animal","Food","Celebrity","Brand","Object"];
const ICONS   = { Country:"🌍", City:"🏙️", Animal:"🦁", Food:"🍕", Celebrity:"⭐", Brand:"💼", Object:"📦" };
const LETTERS = "ABCDEFGHIJKLMNOPRSTW";

function makeId()     { return Math.random().toString(36).substring(2,10); }
function pickLetter() { return LETTERS[Math.floor(Math.random()*LETTERS.length)]; }
function score(v)     { return v ? Object.values(v).reduce((s,e)=>s+(e?.valid?10:0),0) : 0; }

async function apiPost(path, body) {
  const r = await fetch(path, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  const t = await r.text();
  if (!t) throw new Error(`Empty response (${r.status})`);
  const j = JSON.parse(t);
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
}
async function apiGet(path) {
  const r = await fetch(path);
  const t = await r.text();
  if (!t) return null;
  try { const j = JSON.parse(t); return r.ok ? j : null; } catch { return null; }
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
.btn-share{background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;box-shadow:0 0 20px rgba(168,85,247,.3)}
.btn-share:hover{background:linear-gradient(135deg,#6d28d9,#9333ea)}
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
.sscrn{display:flex;flex-direction:column;align-items:center;padding:32px 0;gap:16px}
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
/* online mode picker */
.mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mode-card{background:var(--surf);border:2px solid var(--brd);border-radius:10px;padding:20px 14px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;transition:all .15s;text-align:center}
.mode-card:hover{border-color:var(--acc);background:var(--surf2)}
.mode-card.active{border-color:var(--acc);background:rgba(232,255,71,.07)}
.mode-ico{font-size:32px}
.mode-title{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1px}
.mode-desc{font-size:11px;color:var(--mute);line-height:1.4}
/* lobby */
.lobby-box{background:var(--surf2);border:1px dashed var(--brd);border-radius:10px;padding:20px;display:flex;flex-direction:column;gap:12px}
.lobby-code{font-family:'Bebas Neue',sans-serif;font-size:48px;letter-spacing:8px;color:var(--acc);text-align:center}
.lobby-hint{color:var(--mute);font-size:12px;text-align:center}
.lobby-link{background:var(--surf);border:1px solid var(--brd);border-radius:6px;padding:10px 12px;font-size:12px;color:var(--mute);word-break:break-all;cursor:pointer;transition:border-color .2s}
.lobby-link:hover{border-color:var(--acc);color:var(--acc)}
.copied-badge{display:inline-block;background:rgba(45,255,138,.15);color:var(--ok);border:1px solid var(--ok);border-radius:4px;font-size:11px;padding:2px 8px;font-weight:600}
/* matchmaking */
.mcard{background:var(--surf);border:1px solid var(--brd);border-radius:12px;padding:32px 24px;display:flex;flex-direction:column;align-items:center;gap:20px;text-align:center}
.mcard-title{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:1px}
.mstatus{font-size:14px;color:var(--mute)}
.mfound{color:var(--ok);font-size:15px;font-weight:600}
.pulse-ring{width:80px;height:80px;border-radius:50%;border:3px solid var(--acc);position:relative;display:flex;align-items:center;justify-content:center}
.pulse-ring::after{content:'';position:absolute;inset:-8px;border-radius:50%;border:2px solid var(--acc);opacity:.4;animation:ring 1.5s ease-out infinite}
@keyframes ring{0%{transform:scale(1);opacity:.4}100%{transform:scale(1.4);opacity:0}}
.pulse-ico{font-size:32px}
/* vs / results */
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
/* share toast */
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--ok);color:#0a0a0f;font-weight:700;font-size:14px;padding:10px 20px;border-radius:8px;z-index:999;animation:fadeup .3s ease}
@keyframes fadeup{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
/* share modal */
.modalO{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:flex-end;justify-content:center;padding:18px}
.modal{width:100%;max-width:520px;background:var(--surf);border:1px solid var(--brd);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.6);overflow:hidden}
.modalH{padding:14px 16px;border-bottom:1px solid var(--brd);display:flex;align-items:center;justify-content:space-between}
.modalT{font-weight:700;letter-spacing:.5px}
.modalX{background:none;border:none;color:var(--mute);font-size:20px;cursor:pointer;padding:6px 10px}
.modalX:hover{color:var(--txt)}
.modalB{padding:12px 12px 16px;display:flex;flex-direction:column;gap:10px}
.sgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sbtn{border:1px solid var(--brd);background:var(--surf2);color:var(--txt);border-radius:10px;padding:14px 12px;cursor:pointer;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px}
.sbtn:hover{border-color:var(--acc);color:var(--acc)}
.smini{font-size:12px;color:var(--mute);padding:0 4px 2px}
.sbox{border:1px solid var(--brd);background:var(--bg);border-radius:10px;padding:10px 12px;color:var(--mute);font-size:12px;white-space:pre-wrap;word-break:break-word}
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
  // online mode: "random" | "private"
  const [onlineMode,  setOnlineMode]  = useState("random");
  // private lobby
  const [lobbyCode,   setLobbyCode]   = useState("");
  const [joinCode,    setJoinCode]    = useState("");
  const [lobbyCopied, setLobbyCopied] = useState(false);
  // share score
  const [toast,       setToast]       = useState("");
  const [shareOpen,   setShareOpen]   = useState(false);
  const [shareText,   setShareText]   = useState("");
  const [shareUrl,    setShareUrl]    = useState("");

  const timerRef    = useRef(null);
  const pollRef     = useRef(null);
  const pollAnsRef  = useRef(null);
  const answersR    = useRef({});
  const letterR     = useRef("B");
  const roomR       = useRef("");
  const nameR       = useRef("");
  const myIdR       = useRef(""); // stable per device (localStorage)
  const submittedR  = useRef(false);
  const inputRefs   = useRef([]); // for Enter-to-next-field

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

  // Persist a stable player id across refreshes.
  // This is critical for private rooms: rejoining, finished-state sync, and rematch voting.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const KEY = "alphabetush_player_id";
      let pid = window.localStorage.getItem(KEY);
      if (!pid) {
        pid = makeId();
        window.localStorage.setItem(KEY, pid);
      }
      myIdR.current = pid;
    } catch {
      if (!myIdR.current) myIdR.current = makeId();
    }
  }, []);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);
    clearInterval(pollAnsRef.current);
  }, []);

  // ── Check for lobby invite link on load ──────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("lobby");
    if (invite) {
      setJoinCode(invite.toUpperCase());
      setOnlineMode("private");
      setScreen("online-name");
    }
  }, []);

  // ── Timer ─────────────────────────────────────────────────────────────────
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

  // ── Force-finish an online round when time runs out (even if opponent didn't submit)
  function forceFinishOnline(reason = "Time is up") {
    clearInterval(timerRef.current);
    clearInterval(pollAnsRef.current);
    // If opponent never submitted (or left), show score with opponent = 0
    setOppAnswers({});
    setOppVal(null);
    setToast(reason);
    setTimeout(() => setToast(""), 2200);
    setScreen("online-score");
  }

  // ── Submit + validate (API key stays server-side) ─────────────────────────
  async function doSubmit(l, roomId, forceFinishAfter = false) {
    if (submittedR.current) return;
    submittedR.current = true;
    setSubmitted(true);
    setValidating(true);

    let result;
    try {
      result = await apiPost("/api/validate", { answers: answersR.current, letter: l });
    } catch {
      result = {};
      CATS.forEach(c => {
        const v = (answersR.current[c]||"").trim();
        const ok = v.length >= 3 && v.toLowerCase().startsWith(l.toLowerCase());
        result[c] = { valid: ok, reason: ok ? "Valid" : "Invalid or empty" };
      });
    }

    setValidation(result);
    setValidating(false);

    if (roomId) {
      try {
        await apiPost("/api/room", {
          id: roomId,
          playerId: myIdR.current,
          playerName: nameR.current,
          answers: answersR.current,
          validation: result
        });
      } catch(e) { console.error("save answers:", e); }

      // If time is already over, don't wait forever for the opponent.
      if (forceFinishAfter) {
        forceFinishOnline("Time is up");
      }
    } else {
      setScreen("solo-score");
    }
  }

  // ── Solo ──────────────────────────────────────────────────────────────────
  function startSolo() {
    const l = pickLetter();
    setLetter(l); letterR.current = l;
    setAnswers({}); answersR.current = {};
    setScreen("solo-game");
    startTimer(() => doSubmit(l, null));
  }

  // ── Random matchmaking ────────────────────────────────────────────────────
  async function findMatch() {
    if (!playerName.trim()) return setError("Enter your name first");
    setError("");
    const myId = myIdR.current;

    // IMPORTANT: If the user previously played a private game (or refreshed during a game),
    // `player_rooms` may still bind them to an old room. Clear that so random matchmaking works.
    try { await apiPost("/api/leave-room", { playerId: myId }); } catch {}

    setQueueStatus("searching");
    setScreen("matchmaking");

    try {
      const result = await apiPost("/api/matchmake", { playerId: myId, playerName });
      if (result.matched) {
        launchGame(result.room, result.opponentName);
      } else {
        pollRef.current = setInterval(async () => {
          try {
            const ps = await apiGet(
              `/api/match-status?playerId=${encodeURIComponent(myId)}&playerName=${encodeURIComponent(nameR.current)}`
            );
            if (ps?.matched && ps.room) {
              clearInterval(pollRef.current);
              const opp = (ps.room.players||[]).find(p => p !== nameR.current) || "Opponent";
              setQueueStatus("found");
              setTimeout(() => launchGame(ps.room, opp), 800);
            }
          } catch {}
        }, 2000);
      }
    } catch (e) {
      setScreen("online-name");
      setError("Matchmaking failed: " + e.message);
    }
  }

  // ── Private lobby: create ─────────────────────────────────────────────────
  async function createLobby() {
    if (!playerName.trim()) return setError("Enter your name first");
    setError("");
    try {
      // Clear any previous random/private room binding before creating a new lobby.
      try { await apiPost("/api/leave-room", { playerId: myIdR.current }); } catch {}

      const res = await apiPost("/api/lobby", { action:"create", playerId: myIdR.current, playerName });
      setLobbyCode(res.lobbyCode);
      setLobbyCopied(false);
      setScreen("lobby-wait");
      // Poll until guest joins
      pollRef.current = setInterval(async () => {
        try {
          const ps = await apiPost("/api/lobby", { action:"poll", lobbyCode: res.lobbyCode, playerId: myIdR.current, playerName });
          if (ps.ready) {
            clearInterval(pollRef.current);
            setQueueStatus("found");
            setTimeout(() => launchGame(ps.room, ps.opponentName), 800);
          }
        } catch {}
      }, 2000);
    } catch (e) {
      setError("Failed to create lobby: " + e.message);
    }
  }

  // ── Private lobby: join ───────────────────────────────────────────────────
  async function joinLobby() {
    if (!playerName.trim()) return setError("Enter your name first");
    if (!joinCode.trim())   return setError("Enter a lobby code");
    setError("");
    try {
      // Clear any previous room binding before joining a lobby.
      try { await apiPost("/api/leave-room", { playerId: myIdR.current }); } catch {}

      const res = await apiPost("/api/lobby", {
        action: "join", lobbyCode: joinCode.trim().toUpperCase(),
        playerId: myIdR.current, playerName
      });
      if (res.joined) {
        launchGame(res.room, res.opponentName);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  function getLobbyLink() {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/?lobby=${lobbyCode}`;
  }

  async function copyLobbyLink() {
    try {
      await navigator.clipboard.writeText(getLobbyLink());
      setLobbyCopied(true);
      setTimeout(() => setLobbyCopied(false), 2500);
    } catch {}
  }

  // ── Launch game ───────────────────────────────────────────────────────────
  function launchGame(room, opponentName) {
    roomR.current = room.id;
    setOppName(opponentName);
    const l = room.letter;
    setLetter(l); letterR.current = l;
    setAnswers({}); answersR.current = {};
    setScreen("online-game");
    // When the timer ends:
    // - if we already submitted, force-finish so we don't wait forever
    // - if we didn't submit, submit whatever we have and then force-finish
    startTimer(() => {
      if (submittedR.current) {
        forceFinishOnline("Time is up");
      } else {
        void doSubmit(l, room.id, true);
      }
    });
  }

  // ── Navigation helpers ────────────────────────────────────────────────────
  function goHome() {
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);
    clearInterval(pollAnsRef.current);

    // Clear server-side bindings so switching to random/private later won't stick to old rooms.
    if (myIdR.current) {
      // fire-and-forget
      fetch("/api/leave-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: myIdR.current })
      }).catch(() => {});
    }

    roomR.current = "";
    setLobbyCode("");
    setJoinCode("");
    setOppName("");
    setOppAnswers({});
    setOppVal(null);
    setValidation(null);
    setSubmitted(false);
    setValidating(false);
    // Remove any ?lobby=... from the URL
    if (typeof window !== "undefined") {
      const clean = window.location.origin + window.location.pathname;
      window.history.replaceState({}, "", clean);
    }
    setScreen("home");
  }

  // ── Private rematch: both players must click “Play Again” ──────────────────
  async function rematchSameRoom() {
    const roomId = roomR.current;
    if (!roomId) return;
    setError("");
    try {
      // Register my vote for a rematch. Server will start the rematch only
      // when BOTH players have voted.
      const r = await apiPost("/api/rematch", { roomId, playerId: myIdR.current });

      if (r?.started && r?.room?.letter) {
        const newLetter = r.room.letter;
        setLetter(newLetter); letterR.current = newLetter;
        setAnswers({}); answersR.current = {};
        setOppAnswers({});
        setOppVal(null);
        setValidation(null);
        setSubmitted(false);
        setValidating(false);
        setScreen("online-game");
        startTimer(() => {
          if (submittedR.current) {
            forceFinishOnline("Time is up");
          } else {
            void doSubmit(newLetter, roomId, true);
          }
        });
        return;
      }

      // Not started yet → wait for the other player to click Play Again.
      setScreen("rematch-wait");
    } catch (e) {
      setError("Rematch failed: " + e.message);
    }
  }

async function cancelMatchmaking() {
    clearInterval(pollRef.current);
    try { await apiPost("/api/leave-queue", { playerId: myIdR.current }); } catch {}
    // Also clear any stale room binding just in case.
    try { await apiPost("/api/leave-room", { playerId: myIdR.current }); } catch {}
    setScreen("online-name");
  }

  // ── Poll opponent results ─────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "online-game" || !submitted || validating) return;
    const roomId = roomR.current;
    clearInterval(pollAnsRef.current);
    pollAnsRef.current = setInterval(async () => {
      try {
        const room = await apiGet(`/api/room?id=${roomId}`);
        if (!room) return;
        // Prefer player_ids for robustness (players can choose the same name).
        const myPid = myIdR.current;
        const oppPid = (room.player_ids || []).find(pid => pid && pid !== myPid);
        if (oppPid && room.answers?.[oppPid] && room.validation?.[oppPid]) {
          clearInterval(pollAnsRef.current);
          clearInterval(timerRef.current);
          setOppAnswers(room.answers[oppPid]);
          setOppVal(room.validation[oppPid]);
          setScreen("online-score");
          return;
        }

        // Backward-compat fallback: older rooms keyed by player name.
        const oppNameKey = (room.players||[]).find(p => p !== nameR.current);
        if (oppNameKey && room.answers?.[oppNameKey] && room.validation?.[oppNameKey]) {
          clearInterval(pollAnsRef.current);
          clearInterval(timerRef.current);
          setOppAnswers(room.answers[oppNameKey]);
          setOppVal(room.validation[oppNameKey]);
          setScreen("online-score");
        }
      } catch {}
    }, 2000);
    return () => clearInterval(pollAnsRef.current);
  }, [screen, submitted, validating]);

  // ── Poll for private rematch start (both players clicked Play Again) ───────
  useEffect(() => {
    if (screen !== "rematch-wait") return;
    const roomId = roomR.current;
    if (!roomId) return;
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const room = await apiGet(`/api/room?id=${roomId}`);
        if (!room) return;
        // Rematch is considered started when the letter changes and answers are reset.
        const letterNow = room.letter;
        const answersEmpty = !room.answers || Object.keys(room.answers).length === 0;
        const validationEmpty = !room.validation || Object.keys(room.validation).length === 0;
        if (letterNow && letterNow !== letterR.current && answersEmpty && validationEmpty) {
          clearInterval(pollRef.current);
          launchGame(room, oppName || "Opponent");
        }
      } catch {}
    }, 1500);
    return () => clearInterval(pollRef.current);
  }, [screen, oppName]);

  // ── Share score ───────────────────────────────────────────────────────────
  // Desired behavior:
  // - On mobile (when supported): use the native share sheet (navigator.share)
  // - Otherwise: open our Share Options modal (WhatsApp/Facebook/X/Email/Copy)
  const isProbablyMobile = () => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    return /Android|iPhone|iPad|iPod|IEMobile|Mobile/i.test(ua);
  };

  async function shareScore(pts, total, ltr, isOnline, won, tie) {
    const emoji = isOnline ? (won ? "🏆" : tie ? "🤝" : "😤") : "🎮";
    const result = isOnline ? (won ? "Won" : tie ? "Tied" : "Lost") : "";
    // Use a clean canonical URL (avoid query strings like ?lobby=...)
    const url = typeof window !== "undefined" ? (window.location.origin + "/") : "";
    const text = isOnline
      ? `${emoji} I scored ${pts}/${total} and ${result} in Alphabet Game! Letter: ${ltr}
Can you beat me?`
      : `🎮 I scored ${pts}/${total} in Alphabet Game! Letter: ${ltr}
Try to beat it!`;

    setShareText(text);
    setShareUrl(url);

    // Prefer the native mobile share sheet when available.
    // In many in-app browsers this may be missing; then we fall back to the modal.
    if (typeof navigator !== "undefined" && navigator.share && isProbablyMobile()) {
      try {
        await navigator.share({ title: "Alphabet Game", text, url });
        return; // shared successfully
      } catch (e) {
        // If user cancelled, don't show the modal.
        if (e && (e.name === "AbortError" || e.name === "NotAllowedError")) return;
        // otherwise fall through to modal
      }
    }

    setShareOpen(true);
  }

  // Build share payload text that includes the URL exactly once.
  const shareCombinedText = (txt = shareText, url = shareUrl) => {
    const t = (txt || '').trim();
    const u = (url || '').trim();
    if (!u) return t;
    // If text already contains the url, don't append again
    if (t.includes(u)) return t;
    return `${t} ${u}`.trim();
  };

  function openShareLink(href) {
    try {
      const w = window.open(href, "_blank", "noopener,noreferrer");
      if (!w) window.location.href = href;
    } catch {
      window.location.href = href;
    }
  }

  async function doSystemShare() {
    if (!navigator.share) return;
    try {
      // Passing BOTH text + url improves app availability on mobile.
      await navigator.share({ title: "Alphabet Game", text: shareText, url: shareUrl });
    } catch {
      // user cancelled or share failed; keep modal open
    }
  }

  async function doCopyShare() {
    try {
      await navigator.clipboard.writeText(shareCombinedText());
      setToast("Copied!");
      setTimeout(() => setToast(""), 1800);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = shareCombinedText();
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        setToast("Copied!");
        setTimeout(() => setToast(""), 1800);
      } catch {}
    }
  }

  // ── Enter key: move to next category input ────────────────────────────────
  function handleCatKeyDown(e, idx) {
    if (e.key === "Enter") {
      e.preventDefault();
      const next = inputRefs.current[idx + 1];
      if (next) next.focus();
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const pct   = (timeLeft / DURATION) * 100;
  const tcol  = timeLeft > 20 ? "var(--ok)" : timeLeft > 10 ? "var(--acc)" : "var(--red)";
  const myPts = score(validation);
  const opPts = score(oppVal);
  const maxPts = CATS.length * 10;
  function setAns(cat, val) { setAnswers(p => ({ ...p, [cat]: val })); }

  // ── Category input rows (inlined JSX, no sub-component) ───────────────────
  function catRows(disabled) {
    return (
      <div className="cats">
        {CATS.map((cat, idx) => {
          const val = answers[cat] || "";
          const bad = val.length >= 1 && !val.toLowerCase().startsWith(letter.toLowerCase());
          return (
            <div key={cat} className={`crow${bad?" bad":""}`}>
              <span className="cico">{ICONS[cat]}</span>
              <span className="clbl">{cat}</span>
              <input
                className="cinp"
                placeholder={`${letter}…`}
                value={val}
                onChange={e => setAns(cat, e.target.value)}
                onKeyDown={e => handleCatKeyDown(e, idx)}
                disabled={disabled}
                autoComplete="off"
                ref={el => { inputRefs.current[idx] = el; }}
              />
              <span className="cx">{bad?"❌":""}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCREENS
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === "home") return (
    <div className="G"><div className="noise"/>
      {toast && <div className="toast">{toast}</div>}
      {shareOpen && (
        <div className="modalO" onClick={() => setShareOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modalH">
              <div className="modalT">Share</div>
              <button className="modalX" onClick={() => setShareOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="modalB">
              <div className="smini">Choose an option</div>
              <div className="sgrid">
                {typeof navigator !== "undefined" && navigator.share && (
                  <button className="sbtn" onClick={doSystemShare}><span>📲</span> System</button>
                )}
                <button className="sbtn" onClick={() => openShareLink(`https://wa.me/?text=${encodeURIComponent(shareCombinedText())}`)}><span>🟢</span> WhatsApp</button>
                <button className="sbtn" onClick={() => openShareLink(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`)}><span>🔵</span> Facebook</button>
                <button className="sbtn" onClick={() => openShareLink(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareCombinedText())}`)}><span>𝕏</span> X</button>
                <button className="sbtn" onClick={() => openShareLink(`mailto:?subject=${encodeURIComponent("Alphabet Game")}&body=${encodeURIComponent(shareCombinedText())}`)}><span>✉️</span> Email</button>
                <button className="sbtn" onClick={doCopyShare}><span>📋</span> Copy</button>
              </div>
              <div className="smini">Preview</div>
              <div className="sbox">{shareCombinedText()}</div>
            </div>
          </div>
        </div>
      )}
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
          <button className="back" onClick={goHome}>← Back</button>
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

  // ── Online setup: choose mode ─────────────────────────────────────────────
  if (screen === "online-name") return (
    <div className="G"><div className="noise"/>
      <div className="S">
        <div className="oscr">
          <button className="back" onClick={goHome}>← Back</button>
          <div className="stitle">Play Online</div>

          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div className="flbl">YOUR NAME</div>
            <input className="tinp" placeholder="Enter your name…" value={playerName}
              onChange={e => setPlayerName(e.target.value)} />
          </div>

          <div>
            <div className="flbl" style={{marginBottom:10}}>GAME MODE</div>
            <div className="mode-grid">
              <div className={`mode-card${onlineMode==="random"?" active":""}`} onClick={() => setOnlineMode("random")}>
                <span className="mode-ico">🎲</span>
                <div className="mode-title">Random</div>
                <div className="mode-desc">Match with anyone online instantly</div>
              </div>
              <div className={`mode-card${onlineMode==="private"?" active":""}`} onClick={() => setOnlineMode("private")}>
                <span className="mode-ico">🔒</span>
                <div className="mode-title">Private</div>
                <div className="mode-desc">Create a lobby and invite a friend</div>
              </div>
            </div>
          </div>

          {onlineMode === "private" && (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div className="flbl">HAVE A CODE? JOIN INSTEAD</div>
              <input className="tinp" placeholder="Enter lobby code…" value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={8}
                style={{letterSpacing:4,textTransform:"uppercase",textAlign:"center",fontWeight:700}} />
            </div>
          )}

          {error && <div className="err">{error}</div>}

          {onlineMode === "random" ? (
            <button className="btn btn-p" onClick={findMatch} disabled={!playerName.trim()}>
              <span className="bico">🔍</span> Find Match
            </button>
          ) : joinCode.trim().length >= 4 ? (
            <button className="btn btn-p" onClick={joinLobby} disabled={!playerName.trim()}>
              <span className="bico">🚪</span> Join Lobby
            </button>
          ) : (
            <button className="btn btn-p" onClick={createLobby} disabled={!playerName.trim()}>
              <span className="bico">🏠</span> Create Private Lobby
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // ── Waiting for random match ──────────────────────────────────────────────
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

  // ── Private lobby waiting room ────────────────────────────────────────────
  if (screen === "lobby-wait") {
    const link = getLobbyLink();
    return (
      <div className="G"><div className="noise"/>
        <div className="S">
          <div className="oscr">
            <button className="back" onClick={() => { clearInterval(pollRef.current); setScreen("online-name"); }}>← Cancel</button>
            <div className="stitle">Private Lobby</div>

            {queueStatus === "found" ? (
              <div className="mcard">
                <div style={{fontSize:48}}>🎮</div>
                <div className="mfound">Friend joined!</div>
                <div className="mstatus">Starting game…</div>
              </div>
            ) : (
              <>
                <div className="lobby-box">
                  <div className="lobby-hint">LOBBY CODE</div>
                  <div className="lobby-code">{lobbyCode}</div>
                  <div className="lobby-hint">Share this link with your friend:</div>
                  <div className="lobby-link" onClick={copyLobbyLink} title="Click to copy">
                    {link}
                  </div>
                  <button className="btn btn-o" style={{fontSize:13,padding:"10px 16px"}} onClick={copyLobbyLink}>
                    {lobbyCopied ? <><span className="copied-badge">✓ Copied!</span></> : <><span className="bico">📋</span> Copy Invite Link</>}
                  </button>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,padding:"24px 0"}}>
                  <div className="spin"/>
                  <div style={{color:"var(--mute)",fontSize:13}}>Waiting for your friend to join…</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Waiting for private rematch (both players must accept) ───────────────
  if (screen === "rematch-wait") {
    return (
      <div className="G"><div className="noise"/>
        <div className="S">
          <div className="oscr">
            <div className="stitle">Play Again</div>
            <div className="mcard">
              <div className="pulse-ring"><span className="pulse-ico">🔁</span></div>
              <div className="mcard-title">Waiting for your friend</div>
              <div className="mstatus">They need to press <strong style={{color:"var(--txt)"}}>Play Again</strong> too…</div>
              <div className="spin" style={{width:24,height:24,borderWidth:2}}/>
            </div>
            <button className="btn btn-g" onClick={goHome}>Home</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Solo game ─────────────────────────────────────────────────────────────
  if (screen === "solo-game") return (
    <div className="G"><div className="noise"/>
      <div className="S">
        <div className="ghdr">
          <button className="back" onClick={goHome}>← Quit</button>
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
            {catRows(submitted)}
            {!submitted && (
              <button className="btn btn-p" style={{width:"100%",marginTop:8,marginBottom:24}}
                onClick={() => doSubmit(letter, null)}>Submit Answers</button>
            )}
          </>
        )}
      </div>
    </div>
  );

  // ── Solo score ────────────────────────────────────────────────────────────
  if (screen === "solo-score") return (
    <div className="G"><div className="noise"/>
      {toast && <div className="toast">{toast}</div>}
      {shareOpen && (
        <div className="modalO" onClick={() => setShareOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modalH">
              <div className="modalT">Share</div>
              <button className="modalX" onClick={() => setShareOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="modalB">
              <div className="smini">Choose an option</div>
              <div className="sgrid">
                {typeof navigator !== "undefined" && navigator.share && (
                  <button className="sbtn" onClick={doSystemShare}><span>📲</span> System</button>
                )}
                <button className="sbtn" onClick={() => openShareLink(`https://wa.me/?text=${encodeURIComponent(shareCombinedText())}`)}><span>🟢</span> WhatsApp</button>
                <button className="sbtn" onClick={() => openShareLink(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`)}><span>🔵</span> Facebook</button>
                <button className="sbtn" onClick={() => openShareLink(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareCombinedText())}`)}><span>𝕏</span> X</button>
                <button className="sbtn" onClick={() => openShareLink(`mailto:?subject=${encodeURIComponent("Alphabet Game")}&body=${encodeURIComponent(shareCombinedText())}`)}><span>✉️</span> Email</button>
                <button className="sbtn" onClick={doCopyShare}><span>📋</span> Copy</button>
              </div>
              <div className="smini">Preview</div>
              <div className="sbox">{shareCombinedText()}</div>
            </div>
          </div>
        </div>
      )}
      <div className="S">
        <div className="sscrn">
          <div className="slbl">YOUR SCORE</div>
          <div className="sbig">{myPts}</div>
          <div className="smax">out of {maxPts} · letter {letter}</div>
          <div className="aibadge" style={{fontSize:12}}><div className="aidot"/> AI-validated</div>
          <button className="btn btn-share" style={{width:"100%"}}
            onClick={() => shareScore(myPts, maxPts, letter, false)}>
            <span className="bico">📤</span> Share My Score
          </button>
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
            <button className="btn btn-g" style={{flex:1}} onClick={goHome}>Home</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Online game ───────────────────────────────────────────────────────────
  if (screen === "online-game") return (
    <div className="G"><div className="noise"/>
      <div className="S">
        <div className="ghdr">
          <button className="back" onClick={goHome}>← Quit</button>
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
            {catRows(false)}
            <button className="btn btn-p" style={{width:"100%",marginTop:8,marginBottom:24}}
              onClick={() => doSubmit(letterR.current, roomR.current)}>Submit Answers</button>
          </>
        )}
      </div>
    </div>
  );

  // ── Online score ──────────────────────────────────────────────────────────
  if (screen === "online-score") {
    const won = myPts > opPts, tie = myPts === opPts;
    return (
      <div className="G"><div className="noise"/>
        {toast && <div className="toast">{toast}</div>}
        {shareOpen && (
          <div className="modalO" onClick={() => setShareOpen(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modalH">
                <div className="modalT">Share</div>
                <button className="modalX" onClick={() => setShareOpen(false)} aria-label="Close">✕</button>
              </div>
              <div className="modalB">
                <div className="smini">Choose an option</div>
                <div className="sgrid">
                  {typeof navigator !== "undefined" && navigator.share && (
                    <button className="sbtn" onClick={doSystemShare}><span>📲</span> System</button>
                  )}
                  <button className="sbtn" onClick={() => openShareLink(`https://wa.me/?text=${encodeURIComponent(shareCombinedText())}`)}><span>🟢</span> WhatsApp</button>
                  <button className="sbtn" onClick={() => openShareLink(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`)}><span>🔵</span> Facebook</button>
                  <button className="sbtn" onClick={() => openShareLink(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareCombinedText())}`)}><span>𝕏</span> X</button>
                  <button className="sbtn" onClick={() => openShareLink(`mailto:?subject=${encodeURIComponent("Alphabet Game")}&body=${encodeURIComponent(shareCombinedText())}`)}><span>✉️</span> Email</button>
                  <button className="sbtn" onClick={doCopyShare}><span>📋</span> Copy</button>
                </div>
                <div className="smini">Preview</div>
                <div className="sbox">{shareCombinedText()}</div>
              </div>
            </div>
          </div>
        )}
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
            <button className="btn btn-share" style={{width:"100%"}}
              onClick={() => shareScore(myPts, maxPts, letter, true, won, tie)}>
              <span className="bico">📤</span> Share My Score
            </button>
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
              <button className="btn btn-p" style={{flex:1}} onClick={() => (onlineMode === "private" ? rematchSameRoom() : setScreen("online-name"))}>Play Again</button>
              <button className="btn btn-g" style={{flex:1}} onClick={goHome}>Home</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
