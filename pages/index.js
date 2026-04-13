import { useState, useEffect, useRef } from "react";
import Head from "next/head";

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────
function gaEvent(eventName, params = {}) {
  try {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", eventName, params);
    }
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const ALL_CATS = [
  "Country","City","Animal","Food","Celebrity","Brand","Object",
  "Sport","Movie","Vegetable","Fruit","Name","Car","Color","Flower",
  "Instrument","Profession","River","Language","Clothing"
];
const ALL_ICONS = {
  Country:"🌍", City:"🏙️", Animal:"🦁", Food:"🍕", Celebrity:"⭐",
  Brand:"💼", Object:"📦", Sport:"⚽", Movie:"🎬", Vegetable:"🥦",
  Fruit:"🍎", Name:"👤", Car:"🚗", Color:"🎨", Flower:"🌸",
  Instrument:"🎸", Profession:"👷", River:"🏞️", Language:"🗣️", Clothing:"👕"
};
const NUM_CATS = 7;

function pickCats() {
  const shuffled = [...ALL_CATS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, NUM_CATS);
}

// Use dynamic cats per game — start with default
const CATS    = ["Country","City","Animal","Food","Celebrity","Brand","Object"];
const ICONS   = ALL_ICONS;
const LETTERS_EN = "ABCDEFGHIJKLMNOPRSTW";
const LETTERS_HE = "אבגדהוזחטיכלמנסעפצקרשת";

function makeId()     { return Math.random().toString(36).substring(2,10); }
function pickLetter(lang) {
  const pool = lang === "he" ? LETTERS_HE : LETTERS_EN;
  return pool[Math.floor(Math.random() * pool.length)];
}
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
// TRANSLATIONS
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  en: {
    dir: "ltr",
    badge: "AI-JUDGED WORD GAME",
    tagline: "Fill categories. Beat the clock. Win.",
    playSolo: "Play Solo",
    playOnline: "Play Online",
    soloTitle: "Solo Play",
    yourName: "YOUR NAME",
    namePlaceholder: "Enter your name…",
    startGame: "Start Game",
    onlineTitle: "Play Online",
    gameMode: "GAME MODE",
    random: "Random",
    randomDesc: "Match with anyone online instantly",
    private: "Private",
    privateDesc: "Create a lobby and invite a friend",
    haveCode: "HAVE A CODE? JOIN INSTEAD",
    codePlaceholder: "Enter lobby code…",
    findMatch: "Find Match",
    joinLobby: "Join Lobby",
    createLobby: "Create Private Lobby",
    back: "← Back",
    quit: "← Quit",
    cancel: "← Cancel",
    matchmaking: "Matchmaking",
    findingMatch: "Finding a Match",
    lookingFor: "Looking for an opponent for",
    opponentFound: "Opponent found!",
    startingGame: "Starting game…",
    cancelBtn: "Cancel",
    privateLobby: "Private Lobby",
    lobbyCode: "LOBBY CODE",
    shareLink: "Share this link with your friend:",
    inviteFriend: "Invite Friend 🔗",
    copied: "✓ Copied!",
    waitingForFriend: "Waiting for your friend to join…",
    friendJoined: "Friend joined!",
    playAgain: "Play Again",
    playAgainTitle: "Play Again",
    waitingForFriendRematch: "Waiting for your friend",
    rematchDesc: "They need to press",
    rematchDesc2: "too…",
    home: "Home",
    currentLetter: "CURRENT LETTER",
    submitting: "AI is judging your answers…",
    waitingFor: "Also waiting for",
    submitted: "✓ Submitted — waiting for",
    submitAnswers: "Submit Answers",
    yourScore: "YOUR SCORE",
    outOf: "out of",
    letter: "letter",
    aiValidated: "AI-validated",
    shareScore: "Share My Score",
    results: "RESULTS",
    youWin: "🏆 YOU WIN!",
    tie: "🤝 IT'S A TIE!",
    youLose: "😤 YOU LOSE",
    vs: "VS",
    shareTitle: "Share",
    chooseOption: "Choose an option",
    preview: "Preview",
    system: "System",
    whatsapp: "WhatsApp",
    facebook: "Facebook",
    email: "Email",
    copyBtn: "Copy",
    shareTextSolo: (pts, total, ltr) =>
      `🎮 I scored ${pts}/${total} in Alphabet Game! Letter: ${ltr}\nTry to beat it!`,
    shareTextOnline: (pts, total, ltr, result) =>
      `${result==="Won"?"🏆":result==="Tied"?"🤝":"😤"} I scored ${pts}/${total} and ${result} in Alphabet Game! Letter: ${ltr}\nCan you beat me?`,
    inviteCopyText: (name, link) =>
      `Hey! 👋 ${name} is challenging you to Alphabet Game!\n\nIt's a fast word game: fill 7 categories (Country, City, Animal, Food, Celebrity, Brand, Object) with words starting with the same letter — in 60 seconds. An AI judges your answers!\n\nClick to join and play against ${name}:\n${link}`,
    inviteLandingTitle: "You're Invited! 🎮",
    inviteLandingMsg: (host) =>
      `${host} is challenging you to Alphabet Game! Enter your name below to join the game.`,
    inviteLandingGameDesc:
      "Fill 7 categories with words starting with the same letter. 60 seconds. AI-judged. Beat your friend!",
    joinGame: "Join Game",
    langToggle: "עברית",
    timeUp: "Time is up",
    catLabels: { Country:"Country", City:"City", Animal:"Animal", Food:"Food", Celebrity:"Celebrity", Brand:"Brand", Object:"Object", Sport:"Sport", Movie:"Movie", Vegetable:"Vegetable", Fruit:"Fruit", Name:"Name", Car:"Car", Color:"Color", Flower:"Flower", Instrument:"Instrument", Profession:"Profession", River:"River", Language:"Language", Clothing:"Clothing" },
  },
  he: {
    dir: "rtl",
    badge: "משחק מילים עם שופט AI",
    tagline: "מלא קטגוריות. נצח את השעון. נצח.",
    playSolo: "שחק לבד",
    playOnline: "שחק אונליין",
    soloTitle: "משחק יחיד",
    yourName: "השם שלך",
    namePlaceholder: "הכנס שם…",
    startGame: "התחל משחק",
    onlineTitle: "שחק אונליין",
    gameMode: "מצב משחק",
    random: "אקראי",
    randomDesc: "התחבר לכל אחד באינטרנט מיידית",
    private: "פרטי",
    privateDesc: "צור לובי והזמן חבר",
    haveCode: "יש לך קוד? הצטרף",
    codePlaceholder: "הכנס קוד לובי…",
    findMatch: "מצא יריב",
    joinLobby: "הצטרף ללובי",
    createLobby: "צור לובי פרטי",
    back: "← חזרה",
    quit: "← יציאה",
    cancel: "← ביטול",
    matchmaking: "מחפש יריב",
    findingMatch: "מחפש יריב",
    lookingFor: "מחפש יריב עבור",
    opponentFound: "נמצא יריב!",
    startingGame: "מתחיל משחק…",
    cancelBtn: "ביטול",
    privateLobby: "לובי פרטי",
    lobbyCode: "קוד הלובי",
    shareLink: "שתף את הקישור הזה עם החבר שלך:",
    inviteFriend: "הזמן חבר 🔗",
    copied: "✓ הועתק!",
    waitingForFriend: "ממתין לחבר שיצטרף…",
    friendJoined: "החבר הצטרף!",
    playAgain: "שחק שוב",
    playAgainTitle: "שחק שוב",
    waitingForFriendRematch: "ממתין לחבר",
    rematchDesc: "הם צריכים ללחוץ על",
    rematchDesc2: "גם כן…",
    home: "בית",
    currentLetter: "האות הנוכחית",
    submitting: "ה-AI שופט את התשובות שלך…",
    waitingFor: "גם ממתין ל",
    submitted: "✓ נשלח — ממתין ל",
    submitAnswers: "שלח תשובות",
    yourScore: "הניקוד שלך",
    outOf: "מתוך",
    letter: "אות",
    aiValidated: "מאושר על ידי AI",
    shareScore: "שתף את הניקוד שלי",
    results: "תוצאות",
    youWin: "🏆 ניצחת!",
    tie: "🤝 תיקו!",
    youLose: "😤 הפסדת",
    vs: "נגד",
    shareTitle: "שיתוף",
    chooseOption: "בחר אפשרות",
    preview: "תצוגה מקדימה",
    system: "שיתוף מערכת",
    whatsapp: "וואטסאפ",
    facebook: "פייסבוק",
    email: "אימייל",
    copyBtn: "העתק",
    shareTextSolo: (pts, total, ltr) =>
      `🎮 קיבלתי ${pts}/${total} ב-Alphabet Game! אות: ${ltr}\nנסה לנצח אותי!`,
    shareTextOnline: (pts, total, ltr, result) =>
      `${result==="Won"?"🏆":result==="Tied"?"🤝":"😤"} קיבלתי ${pts}/${total} ב-Alphabet Game! אות: ${ltr}\nאתה יכול לנצח אותי?`,
    inviteCopyText: (name, link) =>
      `היי! 👋 ${name} מאתגר אותך ל-Alphabet Game!\n\nמשחק מילים מהיר: מלא 7 קטגוריות (מדינה, עיר, חיה, אוכל, מפורסם, מותג, חפץ) במילים שמתחילות באותה אות — תוך 60 שניות. ה-AI שופט את התשובות!\n\nלחץ להצטרפות ולמשחק נגד ${name}:\n${link}`,
    inviteLandingTitle: "הוזמנת! 🎮",
    inviteLandingMsg: (host) =>
      `${host} מאתגר אותך ב-Alphabet Game! הכנס שם כדי להצטרף למשחק.`,
    inviteLandingGameDesc:
      "מלא 7 קטגוריות במילים שמתחילות באותה אות. 60 שניות. שופט AI. נצח את החבר!",
    joinGame: "הצטרף למשחק",
    langToggle: "English",
    timeUp: "הזמן נגמר",
    catLabels: { Country:"מדינה", City:"עיר", Animal:"חיה", Food:"אוכל", Celebrity:"מפורסם", Brand:"מותג", Object:"חפץ", Sport:"ספורט", Movie:"סרט", Vegetable:"ירק", Fruit:"פרי", Name:"שם", Car:"רכב", Color:"צבע", Flower:"פרח", Instrument:"כלי נגינה", Profession:"מקצוע", River:"נהר", Language:"שפה", Clothing:"ביגוד" },
  }
};

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
.btn-lang{background:none;border:1px solid var(--brd);color:var(--mute);border-radius:20px;padding:6px 14px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;font-weight:600;transition:all .15s;white-space:nowrap}
.btn-lang:hover{border-color:var(--acc);color:var(--acc)}
.lang-wrap{position:fixed;top:16px;z-index:100}
.lang-wrap-ltr{right:16px}
.lang-wrap-rtl{left:16px}
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
.clbl{font-size:11px;color:var(--mute);width:70px;flex-shrink:0;letter-spacing:.5px;font-weight:500}
.cinp{flex:1;background:transparent;border:none;outline:none;color:var(--txt);font-family:'DM Sans',sans-serif;font-size:16px;font-weight:500}
.cinp::placeholder{color:var(--mute);font-weight:300}
[dir=rtl] .cinp{direction:rtl;text-align:right}
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
.rrow{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-radius:8px;background:var(--surf);border-left:3px solid transparent;direction:ltr}
.rrow.rv{border-left-color:var(--ok)}
.rrow.ri{border-left-color:var(--red);opacity:.8}
.rico{font-size:17px;width:22px;text-align:center;flex-shrink:0;padding-top:2px}
.rcat{font-size:11px;color:var(--mute);width:70px;flex-shrink:0;padding-top:3px}
.rbody{flex:1;min-width:0}
.rans{font-weight:500;font-size:15px}
.rwhy{font-size:11px;color:var(--mute);margin-top:2px;font-style:italic}
[dir=rtl] .rans,[dir=rtl] .rwhy{text-align:right;direction:rtl}
[dir=rtl] .rrow{border-left:none;border-right:3px solid transparent}
[dir=rtl] .rrow.rv{border-right-color:var(--ok)}
[dir=rtl] .rrow.ri{border-right-color:var(--red)}
.rpts{font-family:'Bebas Neue',sans-serif;font-size:20px;flex-shrink:0}
.pt-ok{color:var(--ok)}.pt-no{color:var(--red)}
.oscr{display:flex;flex-direction:column;min-height:100vh;padding-top:24px;gap:20px}
.stitle{font-family:'Bebas Neue',sans-serif;font-size:36px;letter-spacing:1px}
.flbl{font-size:12px;color:var(--mute);letter-spacing:2px;font-weight:500}
.tinp{background:var(--surf);border:1px solid var(--brd);border-radius:8px;padding:14px 16px;color:var(--txt);font-family:'DM Sans',sans-serif;font-size:16px;font-weight:500;width:100%;outline:none;transition:border-color .2s}
.tinp:focus{border-color:var(--acc)}
.err{color:var(--red);font-size:13px;text-align:center;padding:8px;background:rgba(255,71,87,.1);border-radius:6px}
.div{height:1px;background:var(--brd);margin:4px 0}
.mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mode-card{background:var(--surf);border:2px solid var(--brd);border-radius:10px;padding:20px 14px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;transition:all .15s;text-align:center}
.mode-card:hover{border-color:var(--acc);background:var(--surf2)}
.mode-card.active{border-color:var(--acc);background:rgba(232,255,71,.07)}
.mode-ico{font-size:32px}
.mode-title{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1px}
.mode-desc{font-size:11px;color:var(--mute);line-height:1.4}
.lobby-box{background:var(--surf2);border:1px dashed var(--brd);border-radius:10px;padding:20px;display:flex;flex-direction:column;gap:12px}
.lobby-code{font-family:'Bebas Neue',sans-serif;font-size:48px;letter-spacing:8px;color:var(--acc);text-align:center;direction:ltr}
.lobby-hint{color:var(--mute);font-size:12px;text-align:center}
.lobby-link{background:var(--surf);border:1px solid var(--brd);border-radius:6px;padding:10px 12px;font-size:11px;color:var(--mute);word-break:break-all;cursor:pointer;transition:border-color .2s;direction:ltr;text-align:left}
.lobby-link:hover{border-color:var(--acc);color:var(--acc)}
.copied-badge{display:inline-block;background:rgba(45,255,138,.15);color:var(--ok);border:1px solid var(--ok);border-radius:4px;font-size:11px;padding:2px 8px;font-weight:600}
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
.cmpr{display:grid;grid-template-columns:1fr 32px 1fr;gap:6px;align-items:flex-start;direction:ltr}
.cmpc{padding:8px 10px;border-radius:6px;font-size:13px;font-weight:500;background:var(--surf);border:1px solid var(--brd);min-height:38px;display:flex;flex-direction:column;justify-content:center}
.cmpc.cw{border-color:var(--ok);background:rgba(45,255,138,.08)}
.cmpc.cl{opacity:.4}
.cmpw{font-size:10px;color:var(--mute);margin-top:2px;font-style:italic}
.cmpico{text-align:center;font-size:16px;padding-top:10px}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--ok);color:#0a0a0f;font-weight:700;font-size:14px;padding:10px 20px;border-radius:8px;z-index:999;animation:fadeup .3s ease;white-space:nowrap}
@keyframes fadeup{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
.modalO{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:flex-end;justify-content:center;padding:18px}
.modal{width:100%;max-width:520px;background:var(--surf);border:1px solid var(--brd);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.6);overflow:hidden}
.modalH{padding:14px 16px;border-bottom:1px solid var(--brd);display:flex;align-items:center;justify-content:space-between}
.modalT{font-weight:700;letter-spacing:.5px}
.modalX{background:none;border:none;color:var(--mute);font-size:20px;cursor:pointer;padding:6px 10px}
.modalX:hover{color:var(--txt)}
.modalB{padding:12px 12px 16px;display:flex;flex-direction:column;gap:10px}
.sgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.sbtn{border:1px solid var(--brd);background:var(--surf2);color:var(--txt);border-radius:10px;padding:14px 12px;cursor:pointer;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;font-family:'DM Sans',sans-serif}
.sbtn:hover{border-color:var(--acc);color:var(--acc)}
.smini{font-size:12px;color:var(--mute);padding:0 4px 2px}
.sbox{border:1px solid var(--brd);background:var(--bg);border-radius:10px;padding:10px 12px;color:var(--mute);font-size:12px;white-space:pre-wrap;word-break:break-word;direction:ltr;text-align:left}
.invite-card{background:var(--surf);border:2px solid var(--acc);border-radius:14px;padding:24px 20px;display:flex;flex-direction:column;gap:12px;text-align:center;box-shadow:0 0 30px rgba(232,255,71,.15)}
.invite-title{font-family:'Bebas Neue',sans-serif;font-size:30px;letter-spacing:1px;color:var(--acc)}
.invite-msg{font-size:15px;line-height:1.55;color:var(--txt)}
.invite-desc{font-size:13px;color:var(--mute);line-height:1.55;background:var(--surf2);border-radius:8px;padding:12px 14px}
`;

// ─────────────────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  const [screen,      setScreen]      = useState("home");
  const [lang,        setLang]        = useState(() => {
    // Initialize lang from URL on first render to avoid flicker
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("lang");
      if (p === "he" || p === "en") return p;
    }
    return "en";
  });
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
  const [onlineMode,  setOnlineMode]  = useState("random");
  const [lobbyCode,   setLobbyCode]   = useState("");
  const [joinCode,    setJoinCode]    = useState("");
  const [hostName,    setHostName]    = useState(""); // set when arriving via invite link
  const [lobbyCopied, setLobbyCopied] = useState(false);
  const [toast,       setToast]       = useState("");
  const [shareOpen,   setShareOpen]   = useState(false);
  const [shareText,   setShareText]   = useState("");
  const [shareUrl,    setShareUrl]    = useState("");
  const [gameCats,    setGameCats]    = useState(CATS);
  const [speedBonus,  setSpeedBonus]  = useState(0);
  const [timeMode,    setTimeMode]    = useState("timed"); // "timed" or "unlimited"
  const [cookieConsent, setCookieConsent] = useState(null); // null=unknown, true=accepted, false=declined
  const [serviceUnavailable, setServiceUnavailable] = useState(false);

  const timerRef   = useRef(null);
  const pollRef    = useRef(null);
  const pollAnsRef = useRef(null);
  const answersR   = useRef({});
  const letterR    = useRef("B");
  const roomR      = useRef("");
  const nameR      = useRef("");
  const myIdR      = useRef("");
  const submittedR = useRef(false);
  const timeLeftR  = useRef(60);
  const inputRefs  = useRef([]);
  const langR      = useRef((() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("lang");
      if (p === "he" || p === "en") return p;
    }
    return "en";
  })());

  const t = T[lang]; // current translations

  useEffect(() => { answersR.current   = answers;    }, [answers]);
  useEffect(() => { letterR.current    = letter;     }, [letter]);
  useEffect(() => { nameR.current      = playerName; }, [playerName]);
  useEffect(() => { submittedR.current = submitted;  }, [submitted]);
  useEffect(() => { langR.current      = lang;        }, [lang]);

  // Apply RTL/LTR to html element
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("dir", t.dir);
    document.documentElement.setAttribute("lang", lang);
  }, [lang]);

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  // Persist stable player id across refreshes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const KEY = "alphabetush_player_id";
      let pid = window.localStorage.getItem(KEY);
      if (!pid) { pid = makeId(); window.localStorage.setItem(KEY, pid); }
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

  // ── Cookie consent ────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("cookie_consent");
    if (stored === "true")  { setCookieConsent(true);  enableAnalytics(); }
    else if (stored === "false") { setCookieConsent(false); disableAnalytics(); }
    // If not set yet — banner will show (cookieConsent stays null)
  }, []);

  function enableAnalytics() {
    if (typeof window === "undefined") return;
    window["ga-disable-G-MJ9YDW5GW8"] = false;
  }
  function disableAnalytics() {
    if (typeof window === "undefined") return;
    window["ga-disable-G-MJ9YDW5GW8"] = true;
  }
  function acceptCookies() {
    window.localStorage.setItem("cookie_consent", "true");
    setCookieConsent(true);
    enableAnalytics();
    gaEvent("cookie_consent", { label: "accepted" });
  }
  function declineCookies() {
    window.localStorage.setItem("cookie_consent", "false");
    setCookieConsent(false);
    disableAnalytics();
  }
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const invite  = params.get("lobby");
    const langP   = params.get("lang");
    const hostP   = params.get("host");

    if (langP === "he" || langP === "en") { setLang(langP); langR.current = langP; }

    if (invite) {
      setJoinCode(invite.toUpperCase());
      setOnlineMode("private");
      if (hostP) setHostName(hostP);
      setScreen("invite-landing");
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
    setSpeedBonus(0);
    submittedR.current = false;
    timeLeftR.current = DURATION;
    let tm = DURATION;
    timerRef.current = setInterval(() => {
      tm--;
      setTimeLeft(tm);
      timeLeftR.current = tm;
      if (tm <= 0) { clearInterval(timerRef.current); onEnd(); }
    }, 1000);
  }

  function forceFinishOnline(reason) {
    clearInterval(timerRef.current);
    clearInterval(pollAnsRef.current);
    setOppAnswers({});
    setOppVal(null);
    setToast(reason || t.timeUp);
    setTimeout(() => setToast(""), 2200);
    setScreen("online-score");
  }

  // ── Submit + validate ─────────────────────────────────────────────────────
  async function doSubmit(l, roomId, forceFinishAfter = false, cats = gameCats) {
    if (submittedR.current) return;
    submittedR.current = true;
    setSubmitted(true);
    setValidating(true);

    // Capture time remaining BEFORE stopping the timer
    const timeAtSubmit = timeLeftR.current;
    clearInterval(timerRef.current);

    let result;
    try {
      result = await apiPost("/api/validate", { answers: answersR.current, letter: l, lang: langR.current, cats });
    } catch {
      result = {};
      cats.forEach(c => {
        const v = (answersR.current[c]||"").trim();
        const ok = v.length >= 3 && v.toLowerCase().startsWith(l.toLowerCase());
        result[c] = { valid: ok, reason: ok ? "Valid" : "Invalid or empty" };
      });
    }

    setValidation(result);
    setValidating(false);

    // Check if validation service was unavailable
    const isUnavailable = Object.values(result).some(v => v?.timeout === true || v?.reason === "timeout");
    setServiceUnavailable(isUnavailable);
    if (isUnavailable) return; // Don't show score screen yet

    // Speed bonus: only if ALL categories are correct
    const allCorrect = cats.every(c => result[c]?.valid);
    const bonus = allCorrect ? timeAtSubmit : 0;
    setSpeedBonus(bonus);

    // Analytics: game finished
    const baseScore = cats.reduce((s, c) => s + (result[c]?.valid ? 10 : 0), 0);
    const totalScore = baseScore + bonus;
    const answersLabel = cats.map(c => `${c}:${(answersR.current[c]||"—").trim()}`).join("|");
    gaEvent("game_finished", {
      label: answersLabel,
      score: totalScore,
      speed_bonus: bonus,
      letter: l,
      lang: langR.current,
    });

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
      if (forceFinishAfter) forceFinishOnline(t.timeUp);
    } else {
      setScreen("solo-score");
    }
  }

  // ── Solo ──────────────────────────────────────────────────────────────────
  function startSolo() {
    gaEvent("start_game", { label: playerName.trim() || "anonymous", mode: timeMode });
    const l = pickLetter(langR.current);
    const cats = pickCats();
    setLetter(l); letterR.current = l;
    setGameCats(cats);
    setAnswers({}); answersR.current = {};
    setScreen("solo-game");
    if (timeMode === "unlimited") {
      // No timer — just reset state
      setTimeLeft(0);
      setSubmitted(false);
      setValidation(null);
      setValidating(false);
      setSpeedBonus(0);
      submittedR.current = false;
      timeLeftR.current = 0;
    } else {
      startTimer(() => doSubmit(l, null, false, cats));
    }
  }

  // ── Random matchmaking ────────────────────────────────────────────────────
  async function findMatch() {
    if (!playerName.trim()) return setError(t.namePlaceholder.replace("…",""));
    setError("");
    const myId = myIdR.current;
    // Clear any leftover room binding
    try { await apiPost("/api/leave-room", { playerId: myId }); } catch {}
    setQueueStatus("searching");
    setScreen("matchmaking");

    try {
      const result = await apiPost("/api/matchmake", { playerId: myId, playerName, lang: langR.current });
      if (result.matched) {
        const opp = (result.room.players||[]).find(p => p !== playerName) || "Opponent";
        launchGame(result.room, opp);
      } else {
        // Timeout after 2 minutes
        const matchTimeout = setTimeout(async () => {
          clearInterval(pollRef.current);
          try { await apiPost("/api/leave-queue", { playerId: myId }); } catch {}
          setScreen("online-name");
          setError(lang === "he" ? "לא נמצא יריב, נסה שוב" : "No opponent found, please try again");
        }, 120000);

        pollRef.current = setInterval(async () => {
          try {
            const ps = await apiGet(
              `/api/match-status?playerId=${encodeURIComponent(myId)}&playerName=${encodeURIComponent(nameR.current)}&lang=${encodeURIComponent(langR.current)}&_=${Date.now()}`
            );
            if (ps?.matched && ps.room) {
              clearTimeout(matchTimeout);
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
    if (!playerName.trim()) return setError(t.namePlaceholder.replace("…",""));
    setError("");
    try {
      try { await apiPost("/api/leave-room", { playerId: myIdR.current }); } catch {}
      const res = await apiPost("/api/lobby", { action:"create", playerId: myIdR.current, playerName, lang: langR.current });
      setLobbyCode(res.lobbyCode);
      setLobbyCopied(false);
      setQueueStatus("searching"); // reset so "found" state is fresh
      setScreen("lobby-wait");
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
    if (!playerName.trim()) return setError(t.namePlaceholder.replace("…",""));
    if (!joinCode.trim())   return setError("Enter a lobby code");
    setError("");
    try {
      try { await apiPost("/api/leave-room", { playerId: myIdR.current }); } catch {}
      const res = await apiPost("/api/lobby", {
        action: "join", lobbyCode: joinCode.trim().toUpperCase(),
        playerId: myIdR.current, playerName
      });
      if (res.joined) {
        // Apply host's language so the friend plays in the same language
        if (res.lang && res.lang !== langR.current) {
          setLang(res.lang);
          langR.current = res.lang;
        }
        launchGame(res.room, res.opponentName);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  // Build lobby link WITH lang + host name for invite landing
  function getLobbyLink(code) {
    if (typeof window === "undefined") return "";
    const base = window.location.origin + "/";
    const lobbyVal = encodeURIComponent(code || lobbyCode);
    const langVal  = encodeURIComponent(langR.current || lang);
    const hostVal  = playerName.trim() ? "&host=" + encodeURIComponent(playerName.trim()) : "";
    return `${base}?lobby=${lobbyVal}&lang=${langVal}${hostVal}`;
  }

  // Copy invite text WITH game description
  async function copyLobbyLink() {
    const link = getLobbyLink(lobbyCode);
    const text = t.inviteCopyText(playerName.trim() || "Someone", link);
    try {
      await navigator.clipboard.writeText(text);
      setLobbyCopied(true);
      setTimeout(() => setLobbyCopied(false), 2500);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta);
        ta.select(); document.execCommand("copy"); ta.remove();
        setLobbyCopied(true);
        setTimeout(() => setLobbyCopied(false), 2500);
      } catch {}
    }
  }

  // ── Invite friend via share sheet (same as score sharing) ────────────────
  async function shareLobbyLink() {
    const link = getLobbyLink(lobbyCode);
    // inviteCopyText already includes the link at the end — don't pass url separately
    // to navigator.share or it will appear twice. Pass empty url so share sheet
    // doesn't append it again.
    const text = t.inviteCopyText(playerName.trim() || "Someone", link);
    setShareText(text);
    setShareUrl("");  // empty — link is already embedded in text
    if (typeof navigator !== "undefined" && navigator.share && isProbablyMobile() && !isFacebookBrowser()) {
      try { await navigator.share({ title: "Alphabet Game", text }); return; }
      catch (e) { if (e?.name === "AbortError" || e?.name === "NotAllowedError") return; }
    }
    setShareOpen(true);
  }

  // ── Launch game ───────────────────────────────────────────────────────────
  function launchGame(room, opponentName) {
    roomR.current = room.id;
    setOppName(opponentName);
    const l = room.letter;
    setLetter(l); letterR.current = l;
    setAnswers({}); answersR.current = {};
    setScreen("online-game");
    startTimer(() => {
      if (submittedR.current) forceFinishOnline(t.timeUp);
      else void doSubmit(l, room.id, true);
    });
  }

  // ── Go home ───────────────────────────────────────────────────────────────
  function goHome() {
    gaEvent("click_home", { from: screen });
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);
    clearInterval(pollAnsRef.current);
    if (myIdR.current) {
      fetch("/api/leave-room", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ playerId: myIdR.current })
      }).catch(() => {});
    }
    roomR.current = "";
    setLobbyCode(""); setJoinCode(""); setHostName("");
    setOppName(""); setOppAnswers({}); setOppVal(null);
    setValidation(null); setSubmitted(false); setValidating(false);
    setQueueStatus("searching");
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.origin + "/");
    }
    setScreen("home");
  }

  async function cancelMatchmaking() {
    clearInterval(pollRef.current);
    try { await apiPost("/api/leave-queue", { playerId: myIdR.current }); } catch {}
    try { await apiPost("/api/leave-room",  { playerId: myIdR.current }); } catch {}
    setScreen("online-name");
  }

  // ── Rematch ───────────────────────────────────────────────────────────────
  async function rematchSameRoom() {
    const roomId = roomR.current;
    if (!roomId) return;
    setError("");
    try {
      const r = await apiPost("/api/rematch", { roomId, playerId: myIdR.current });
      if (r?.started && r?.room?.letter) {
        const nl = r.room.letter;
        setLetter(nl); letterR.current = nl;
        setAnswers({}); answersR.current = {};
        setOppAnswers({}); setOppVal(null);
        setValidation(null); setSubmitted(false); setValidating(false);
        setScreen("online-game");
        startTimer(() => {
          if (submittedR.current) forceFinishOnline(t.timeUp);
          else void doSubmit(nl, roomId, true);
        });
        return;
      }
      setScreen("rematch-wait");
    } catch (e) {
      setError("Rematch failed: " + e.message);
    }
  }

  // ── Poll opponent results ─────────────────────────────────────────────────
  useEffect(() => {
    if ((screen !== "online-game" && screen !== "online-score") || !submitted || validating) return;
    if (screen === "online-score" && oppVal) return; // already have opp results
    const roomId = roomR.current;
    clearInterval(pollAnsRef.current);
    pollAnsRef.current = setInterval(async () => {
      try {
        const room = await apiGet(`/api/room?id=${roomId}&_=${Date.now()}`);
        if (!room) return;
        const myPid = myIdR.current;
        if (!myPid) return; // wait until player id is loaded
        const oppPid = (room.player_ids||[]).find(pid => pid && pid !== myPid);
        if (oppPid && oppPid !== myPid && room.answers?.[oppPid] && room.validation?.[oppPid]) {
          clearInterval(pollAnsRef.current);
          clearInterval(timerRef.current);
          setOppAnswers(room.answers[oppPid]);
          setOppVal(room.validation[oppPid]);
          setScreen("online-score");
          return;
        }
        // Fallback: keyed by name — only if oppPid not found
        if (!oppPid || oppPid === myPid) {
          const oppN = (room.players||[]).find(p => p !== nameR.current);
          if (oppN && room.answers?.[oppN] && room.validation?.[oppN]) {
            clearInterval(pollAnsRef.current);
            clearInterval(timerRef.current);
            setOppAnswers(room.answers[oppN]);
            setOppVal(room.validation[oppN]);
            setScreen("online-score");
          }
        }
      } catch {}
    }, 2000);
    return () => clearInterval(pollAnsRef.current);
  }, [screen, submitted, validating]);

  // ── Poll rematch ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "rematch-wait") return;
    const roomId = roomR.current;
    if (!roomId) return;
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const room = await apiGet(`/api/room?id=${roomId}`);
        if (!room) return;
        const answersEmpty = !room.answers || Object.keys(room.answers).length === 0;
        const validationEmpty = !room.validation || Object.keys(room.validation).length === 0;
        if (room.letter && room.letter !== letterR.current && answersEmpty && validationEmpty) {
          clearInterval(pollRef.current);
          launchGame(room, oppName || "Opponent");
        }
      } catch {}
    }, 1500);
    return () => clearInterval(pollRef.current);
  }, [screen, oppName]);

  // ── Share score ───────────────────────────────────────────────────────────
  const isProbablyMobile = () =>
    typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|IEMobile|Mobile/i.test(navigator.userAgent||"");

  const isFacebookBrowser = () =>
    typeof navigator !== "undefined" && /FBAN|FBAV|FB_IAB/i.test(navigator.userAgent||"");

  async function shareScore(pts, total, ltr, isOnline, won, tie) {
    gaEvent("click_share", { label: isOnline ? "online" : "solo", score: pts });
    const result = isOnline ? (won ? "Won" : tie ? "Tied" : "Lost") : "";
    const base = typeof window !== "undefined" ? window.location.origin : "https://www.alphabetush.com";
    const url = `${base}/?utm_source=share&utm_medium=viral&utm_campaign=score&lang=${langR.current}`;
    // Embed URL directly in text so it appears in all share methods
    const baseText = isOnline ? t.shareTextOnline(pts, total, ltr, result) : t.shareTextSolo(pts, total, ltr);
    const text = `${baseText}\n${url}`;
    setShareText(text); setShareUrl("");
    if (typeof navigator !== "undefined" && navigator.share && isProbablyMobile() && !isFacebookBrowser()) {
      try { await navigator.share({ title:"Alphabet Game", text }); return; }
      catch(e) { if (e?.name==="AbortError" || e?.name==="NotAllowedError") return; }
    }
    setShareOpen(true);
  }

  const shareCombinedText = (txt=shareText, url=shareUrl) => {
    const tx=(txt||"").trim(), u=(url||"").trim();
    if (!u) return tx;
    if (tx.includes(u)) return tx;
    return `${tx} ${u}`.trim();
  };

  function openShareLink(href) {
    try { const w=window.open(href,"_blank","noopener,noreferrer"); if (!w) window.location.href=href; }
    catch { window.location.href=href; }
  }
  async function doSystemShare() {
    if (!navigator.share) return;
    try { await navigator.share({ title:"Alphabet Game", text:shareText, url:shareUrl }); } catch {}
  }
  async function doCopyShare() {
    const c = shareCombinedText();
    try { await navigator.clipboard.writeText(c); }
    catch {
      const ta=document.createElement("textarea"); ta.value=c;
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    setToast(t.copied); setTimeout(()=>setToast(""),1800);
  }

  // ── Enter → next input ────────────────────────────────────────────────────
  function handleCatKeyDown(e, idx) {
    // Android "Go" key sends Enter or Process
    if (e.key === "Enter" || e.key === "Go" || e.keyCode === 13) {
      e.preventDefault();
      const next = inputRefs.current[idx+1];
      if (next) {
        next.focus();
      } else {
        // Last category — submit answers
        if (!submittedR.current) {
          doSubmit(letterR.current, roomR.current || null);
        }
      }
    }
  }

  function handleCatKeyUp(e, idx) {
    // Fallback for Android keyboards that fire keyup but not keydown for Go
    if (e.key === "Enter" || e.keyCode === 13) {
      const next = inputRefs.current[idx+1];
      if (!next && !submittedR.current) {
        doSubmit(letterR.current, roomR.current || null);
      }
    }
  }

  // ── Toggle language ───────────────────────────────────────────────────────
  function toggleLang() {
    setLang(l => {
      const next = l === "en" ? "he" : "en";
      gaEvent("click_language", { label: next });
      langR.current = next;
      try { window.localStorage.setItem("alphabetush_lang", next); } catch {}
      // Update URL so lang persists on refresh (but don't add lobby params)
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        params.set("lang", next);
        // Remove lobby/host params — user is on the main app, not an invite
        params.delete("lobby");
        params.delete("host");
        const qs = params.toString();
        window.history.replaceState({}, "", window.location.origin + "/" + (qs ? "?" + qs : ""));
      }
      return next;
    });
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const pct   = (timeLeft / DURATION) * 100;
  const tcol  = timeLeft > 20 ? "var(--ok)" : timeLeft > 10 ? "var(--acc)" : "var(--red)";
  const myPts  = score(validation) + speedBonus;
  const opPts  = score(oppVal);
  const maxPts = gameCats.length * 10 + DURATION;
  function setAns(cat, val) { setAnswers(p => ({...p, [cat]:val})); }

  // ── Reusable components ───────────────────────────────────────────────────
  function LangBtn() {
    return (
      <div className={`lang-wrap ${t.dir==="rtl" ? "lang-wrap-rtl" : "lang-wrap-ltr"}`}>
        <button className="btn-lang" onClick={toggleLang}>{t.langToggle}</button>
      </div>
    );
  }

  function LegalLinks() {
    const isHe = lang === "he";
    return (
      <div style={{
        position:"fixed", bottom: cookieConsent === null ? 80 : 12,
        left:"50%", transform:"translateX(-50%)",
        display:"flex", gap:12, alignItems:"center",
        zIndex:100, whiteSpace:"nowrap"
      }}>
        <a href="/privacy" style={{color:"#a0a0b8",fontSize:12,textDecoration:"none"}}>
          {isHe ? "פרטיות" : "Privacy"}
        </a>
        <span style={{color:"#a0a0b8",fontSize:12}}>·</span>
        <a href="/terms" style={{color:"#a0a0b8",fontSize:12,textDecoration:"none"}}>
          {isHe ? "תנאים" : "Terms"}
        </a>
        <span style={{color:"#a0a0b8",fontSize:12}}>·</span>
        <a href="mailto:info@alphabetush.com" style={{color:"#a0a0b8",fontSize:12,textDecoration:"none"}}>
          {isHe ? "צור קשר" : "Contact Us"}
        </a>
      </div>
    );
  }

  function ShareModal() {
    if (!shareOpen) return null;
    return (
      <div className="modalO" onClick={()=>setShareOpen(false)}>
        <div className="modal" onClick={e=>e.stopPropagation()}>
          <div className="modalH">
            <div className="modalT">{t.shareTitle}</div>
            <button className="modalX" onClick={()=>setShareOpen(false)}>✕</button>
          </div>
          <div className="modalB">
            <div className="smini">{t.chooseOption}</div>
            <div className="sgrid">
              {typeof navigator!=="undefined" && navigator.share && (
                <button className="sbtn" onClick={doSystemShare}><span>📲</span> {t.system}</button>
              )}
              <button className="sbtn" onClick={()=>openShareLink(`https://wa.me/?text=${encodeURIComponent(shareCombinedText())}`)}><span>🟢</span> {t.whatsapp}</button>
              <button className="sbtn" onClick={()=>openShareLink(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`)}><span>🔵</span> {t.facebook}</button>
              <button className="sbtn" onClick={()=>openShareLink(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareCombinedText())}`)}><span>𝕏</span> X</button>
              <button className="sbtn" onClick={()=>openShareLink(`mailto:?subject=${encodeURIComponent("Alphabet Game")}&body=${encodeURIComponent(shareCombinedText())}`)}><span>✉️</span> {t.email}</button>
              <button className="sbtn" onClick={doCopyShare}><span>📋</span> {t.copyBtn}</button>
            </div>
            <div className="smini">{t.preview}</div>
            <div className="sbox">{shareCombinedText()}</div>
          </div>
        </div>
      </div>
    );
  }

  function CookieBanner() {
    if (cookieConsent !== null) return null;
    const isHe = lang === "he";
    return (
      <div style={{
        position:"fixed", bottom:0, left:0, right:0, zIndex:9999,
        background:"#1c1c28", borderTop:"2px solid #e8ff47",
        padding:"14px 20px", display:"flex", flexWrap:"wrap",
        alignItems:"center", gap:12, justifyContent:"space-between",
        direction: isHe ? "rtl" : "ltr"
      }}>
        <div style={{flex:1, minWidth:200}}>
          <p style={{color:"#f0f0ff", fontSize:13, margin:0, lineHeight:1.5}}>
            {isHe
              ? <>🍪 אנו משתמשים ב-Google Analytics. <a href="/privacy" style={{color:"#e8ff47"}}>מדיניות פרטיות</a></>
              : <>🍪 We use Google Analytics. <a href="/privacy" style={{color:"#e8ff47"}}>Privacy Policy</a></>
            }
          </p>
        </div>
        <div style={{display:"flex", gap:8, flexShrink:0}}>
          <button onClick={declineCookies} style={{
            background:"transparent", border:"1px solid #6b6b8a",
            color:"#f0f0ff", borderRadius:6, padding:"8px 16px",
            fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif"
          }}>
            {isHe ? "דחייה" : "Decline"}
          </button>
          <button onClick={acceptCookies} style={{
            background:"#e8ff47", border:"none", color:"#0a0a0f",
            borderRadius:6, padding:"8px 16px", fontSize:13,
            cursor:"pointer", fontWeight:700, fontFamily:"'DM Sans',sans-serif"
          }}>
            {isHe ? "אישור" : "Accept"}
          </button>
        </div>
      </div>
    );
  }

  function catRows(disabled) {
    return (
      <div className="cats">
        {gameCats.map((cat, idx) => {
          const val = answers[cat]||"";
          const bad = val.length>=1 && !val.toLowerCase().startsWith(letter.toLowerCase());
          return (
            <div key={cat} className={`crow${bad?" bad":""}`}>
              <span className="cico">{ICONS[cat]}</span>
              <span className="clbl">{t.catLabels[cat]}</span>
              <input
                className="cinp"
                placeholder={`${letter}…`}
                value={val}
                onChange={e=>setAns(cat,e.target.value)}
                onKeyDown={e=>handleCatKeyDown(e,idx)}
                onKeyUp={e=>handleCatKeyUp(e,idx)}
                disabled={disabled}
                autoComplete="off"
                enterKeyHint={idx === gameCats.length - 1 ? "go" : "next"}
                ref={el=>{inputRefs.current[idx]=el;}}
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

  // ── HOME ─────────────────────────────────────────────────────────────────
  if (screen==="home") return (
    <div className="G" dir={t.dir}>
      <LangBtn/>
      <div className="noise"/>
      {toast && <div className="toast">{toast}</div>}
      <ShareModal/>
      <CookieBanner/>
      <LegalLinks/>
      <div className="S">
        <div className="home">
          <div className="logo">
            <div className="lbadge">{t.badge}</div>
            <div className="ltitle">ALPHABET<br/>GAME</div>
            <div className="lsub">{t.tagline}</div>
            <div style={{color:"var(--mute)",fontSize:11,marginTop:6,letterSpacing:0.5}}>
              {lang==="he" ? "משחק ארץ עיר · סטופ אונליין · שופט AI" : "Scattergories · Stop Game · AI Judge"}
            </div>
          </div>
          <div className="menu">
            <button className="btn btn-p" onClick={()=>{ gaEvent("click_play_solo"); setScreen("solo-name"); }}><span className="bico">🎮</span> {t.playSolo}</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── SOLO NAME ─────────────────────────────────────────────────────────────
  if (screen==="solo-name") return (
    <div className="G" dir={t.dir}><LangBtn/><CookieBanner/><LegalLinks/><div className="noise"/>
      <div className="S">
        <div className="oscr">
          <button className="back" onClick={goHome}>{t.back}</button>
          <div className="stitle">{t.soloTitle}</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div className="flbl">{t.yourName}</div>
            <input className="tinp" placeholder={t.namePlaceholder} value={playerName}
              onChange={e=>setPlayerName(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&playerName.trim()&&startSolo()} />
          </div>
          <div>
            <div className="flbl" style={{marginBottom:10}}>{lang==="he" ? "מצב משחק" : "GAME MODE"}</div>
            <div className="mode-grid">
              <div className={`mode-card${timeMode==="timed"?" active":""}`} onClick={()=>setTimeMode("timed")}>
                <span className="mode-ico">⏱️</span>
                <div className="mode-title">{lang==="he" ? "עם זמן" : "Timed"}</div>
                <div className="mode-desc">{lang==="he" ? "60 שניות" : "60 seconds"}</div>
              </div>
              <div className={`mode-card${timeMode==="unlimited"?" active":""}`} onClick={()=>setTimeMode("unlimited")}>
                <span className="mode-ico">♾️</span>
                <div className="mode-title">{lang==="he" ? "ללא זמן" : "Unlimited"}</div>
                <div className="mode-desc">{lang==="he" ? "בלי מגבלת זמן" : "No time limit"}</div>
              </div>
            </div>
          </div>
          <button className="btn btn-p" onClick={startSolo} disabled={!playerName.trim()}>
            <span className="bico">🚀</span> {t.startGame}
          </button>
        </div>
      </div>
    </div>
  );

  // ── INVITE LANDING ────────────────────────────────────────────────────────
  // Shown when user opens a private game link. Explains the game, shows who invited them,
  // asks for their name, then directly joins the lobby.
  if (screen==="invite-landing") return (
    <div className="G" dir={t.dir}><LangBtn/><div className="noise"/>
      <div className="S">
        <div className="oscr" style={{paddingTop:40,paddingBottom:40}}>
          <div className="invite-card">
            <div className="invite-title">{t.inviteLandingTitle}</div>
            <div className="invite-msg">{t.inviteLandingMsg(hostName||"Someone")}</div>
            <div className="invite-desc">{t.inviteLandingGameDesc}</div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div className="flbl">{t.yourName}</div>
            <input
              className="tinp"
              placeholder={t.namePlaceholder}
              value={playerName}
              autoFocus
              onChange={e=>setPlayerName(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&playerName.trim()&&joinLobby()}
            />
          </div>

          {error && <div className="err">{error}</div>}

          <button className="btn btn-p" onClick={joinLobby} disabled={!playerName.trim()}>
            <span className="bico">🚪</span> {t.joinGame}
          </button>
          <button className="back" onClick={goHome} style={{alignSelf:"center"}}>{t.back}</button>
        </div>
      </div>
    </div>
  );

  // ── ONLINE NAME ───────────────────────────────────────────────────────────
  if (screen==="online-name") return (
    <div className="G" dir={t.dir}><LangBtn/><div className="noise"/>
      <div className="S">
        <div className="oscr">
          <button className="back" onClick={goHome}>{t.back}</button>
          <div className="stitle">{t.onlineTitle}</div>

          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div className="flbl">{t.yourName}</div>
            <input className="tinp" placeholder={t.namePlaceholder} value={playerName}
              onChange={e=>setPlayerName(e.target.value)} />
          </div>

          <div>
            <div className="flbl" style={{marginBottom:10}}>{t.gameMode}</div>
            <div className="mode-grid">
              <div className={`mode-card${onlineMode==="random"?" active":""}`} onClick={()=>setOnlineMode("random")}>
                <span className="mode-ico">🎲</span>
                <div className="mode-title">{t.random}</div>
                <div className="mode-desc">{t.randomDesc}</div>
              </div>
              <div className={`mode-card${onlineMode==="private"?" active":""}`} onClick={()=>setOnlineMode("private")}>
                <span className="mode-ico">🔒</span>
                <div className="mode-title">{t.private}</div>
                <div className="mode-desc">{t.privateDesc}</div>
              </div>
            </div>
          </div>

          {onlineMode==="private" && (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div className="flbl">{t.haveCode}</div>
              <input className="tinp" placeholder={t.codePlaceholder} value={joinCode}
                onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={8}
                style={{letterSpacing:4,textTransform:"uppercase",textAlign:"center",fontWeight:700,direction:"ltr"}} />
            </div>
          )}

          {error && <div className="err">{error}</div>}

          {onlineMode==="random" ? (
            <button className="btn btn-p" onClick={findMatch} disabled={!playerName.trim()}>
              <span className="bico">🔍</span> {t.findMatch}
            </button>
          ) : joinCode.trim().length>=4 ? (
            <button className="btn btn-p" onClick={joinLobby} disabled={!playerName.trim()}>
              <span className="bico">🚪</span> {t.joinLobby}
            </button>
          ) : (
            <button className="btn btn-p" onClick={createLobby} disabled={!playerName.trim()}>
              <span className="bico">🏠</span> {t.createLobby}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // ── MATCHMAKING ───────────────────────────────────────────────────────────
  if (screen==="matchmaking") return (
    <div className="G" dir={t.dir}><LangBtn/><div className="noise"/>
      <div className="S">
        <div className="oscr">
          <div className="stitle">{t.matchmaking}</div>
          <div className="mcard">
            {queueStatus==="found" ? (
              <><div style={{fontSize:48}}>🎮</div>
              <div className="mfound">{t.opponentFound}</div>
              <div className="mstatus">{t.startingGame}</div></>
            ) : (
              <><div className="pulse-ring"><span className="pulse-ico">🔍</span></div>
              <div className="mcard-title">{t.findingMatch}</div>
              <div className="mstatus">{t.lookingFor} <strong style={{color:"var(--txt)"}}>{playerName}</strong>…</div>
              <div className="spin" style={{width:24,height:24,borderWidth:2}}/></>
            )}
          </div>
          {queueStatus!=="found" && <button className="btn btn-g" onClick={cancelMatchmaking}>{t.cancelBtn}</button>}
        </div>
      </div>
    </div>
  );

  // ── LOBBY WAIT ────────────────────────────────────────────────────────────
  if (screen==="lobby-wait") {
    const link = getLobbyLink(lobbyCode);
    return (
      <div className="G" dir={t.dir}><LangBtn/><div className="noise"/>
        <div className="S">
          <div className="oscr">
            <button className="back" onClick={()=>{clearInterval(pollRef.current);setScreen("online-name");}}>{t.cancel}</button>
            <div className="stitle">{t.privateLobby}</div>

            {queueStatus==="found" ? (
              <div className="mcard">
                <div style={{fontSize:48}}>🎮</div>
                <div className="mfound">{t.friendJoined}</div>
                <div className="mstatus">{t.startingGame}</div>
              </div>
            ) : (
              <>
                <div className="lobby-box">
                  <div className="lobby-hint">{t.lobbyCode}</div>
                  <div className="lobby-code">{lobbyCode}</div>
                  <div className="lobby-hint">{t.shareLink}</div>
                  <div className="lobby-link" onClick={copyLobbyLink} title="Click to copy">{link}</div>
                  <button className="btn btn-share" style={{width:"100%",marginTop:4}} onClick={shareLobbyLink}>
                    <span className="bico">🔗</span> {t.inviteFriend}
                  </button>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,padding:"24px 0"}}>
                  <div className="spin"/>
                  <div style={{color:"var(--mute)",fontSize:13}}>{t.waitingForFriend}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── REMATCH WAIT ──────────────────────────────────────────────────────────
  if (screen==="rematch-wait") return (
    <div className="G" dir={t.dir}><LangBtn/><div className="noise"/>
      <div className="S">
        <div className="oscr">
          <div className="stitle">{t.playAgainTitle}</div>
          <div className="mcard">
            <div className="pulse-ring"><span className="pulse-ico">🔁</span></div>
            <div className="mcard-title">{t.waitingForFriendRematch}</div>
            <div className="mstatus">{t.rematchDesc} <strong style={{color:"var(--txt)"}}>{t.playAgain}</strong> {t.rematchDesc2}</div>
            <div className="spin" style={{width:24,height:24,borderWidth:2}}/>
          </div>
          <button className="btn btn-g" onClick={goHome}>{t.home}</button>
        </div>
      </div>
    </div>
  );

  // ── SOLO GAME ─────────────────────────────────────────────────────────────
  if (screen==="solo-game") return (
    <div className="G" dir={t.dir}><div className="noise"/>
      <div className="S">
        <div className="ghdr">
          <button className="back" onClick={goHome}>{t.quit}</button>
          <span style={{fontSize:13,color:"var(--mute)"}}>{playerName}</span>
        </div>
        <div className="ldisplay">
          <div className="lbg">{letter}</div>
          <div className="lmain">{letter}</div>
          <div className="llbl">{t.currentLetter}</div>
        </div>
        {timeMode === "timed" ? (
          <>
            <div className="tbar-wrap"><div className="tbar" style={{width:`${pct}%`,background:tcol}}/></div>
            <div className="tnum" style={{color:tcol}}>{String(timeLeft).padStart(2,"00")}</div>
          </>
        ) : (
          <div style={{textAlign:"center",padding:"8px 0",color:"var(--mute)",fontSize:13,letterSpacing:2}}>
            {lang==="he" ? "♾️ ללא הגבלת זמן" : "♾️ UNLIMITED"}
          </div>
        )}
        {validating ? (
          <div className="vwrap">
            <div className="spin"/>
            <div className="aibadge"><div className="aidot"/> {t.submitting}</div>
          </div>
        ) : serviceUnavailable ? (
          <div style={{textAlign:"center",padding:"32px 16px",display:"flex",flexDirection:"column",gap:16,alignItems:"center"}}>
            <div style={{fontSize:36}}>⚠️</div>
            <div style={{color:"var(--txt)",fontSize:16,fontWeight:600}}>
              {lang==="he" ? "שירות הולידציה לא זמין כרגע" : "Validation service unavailable"}
            </div>
            <div style={{color:"var(--mute)",fontSize:13}}>
              {lang==="he" ? "נסה שוב עוד כמה שניות" : "Please try again in a few seconds"}
            </div>
            <button className="btn btn-p" style={{width:"100%"}} onClick={async () => {
              setServiceUnavailable(false);
              setValidating(true);
              try {
                const result = await apiPost("/api/validate", { answers: answersR.current, letter, lang: langR.current, cats: gameCats });
                const isUnavailable = Object.values(result).some(v => v?.timeout === true || v?.reason === "timeout");
                setServiceUnavailable(isUnavailable);
                if (!isUnavailable) {
                  setValidation(result);
                  setValidating(false);
                  setScreen("solo-score");
                } else {
                  setValidating(false);
                }
              } catch {
                setValidating(false);
                setServiceUnavailable(true);
              }
            }}>
              {lang==="he" ? "🔄 נסה שוב" : "🔄 Try Again"}
            </button>
            <button className="btn btn-g" style={{width:"100%"}} onClick={goHome}>
              {t.home}
            </button>
          </div>
        ) : (
          <>
            {catRows(submitted)}
            {!submitted && (
              <button type="button" tabIndex={-1} className="btn btn-p" style={{width:"100%",marginTop:8,marginBottom:24}}
                onClick={()=>doSubmit(letter,null)}>{t.submitAnswers}</button>
            )}
          </>
        )}
      </div>
    </div>
  );

  // ── SOLO SCORE ────────────────────────────────────────────────────────────
  if (screen==="solo-score") return (
    <div className="G" dir={t.dir}><div className="noise"/>
      {toast && <div className="toast">{toast}</div>}
      <ShareModal/>
      <CookieBanner/>
      <LegalLinks/>
      <div className="S">
        <div className="sscrn">
          <div className="slbl">{t.yourScore}</div>
          <div className="sbig">{myPts}</div>
          <div className="smax">{t.outOf} {maxPts} · {t.letter} {letter}</div>
          {speedBonus > 0 && (
            <div style={{background:"rgba(232,255,71,.1)",border:"1px solid var(--acc)",borderRadius:8,padding:"6px 14px",fontSize:13,color:"var(--acc)",fontWeight:600}}>
              ⚡ {lang==="he" ? `בונוס מהירות +${speedBonus}` : `Speed bonus +${speedBonus}`}
            </div>
          )}
          <div className="aibadge" style={{fontSize:12}}><div className="aidot"/> {t.aiValidated}</div>
          <button className="btn btn-share" style={{width:"100%"}}
            onClick={()=>shareScore(myPts,maxPts,letter,false)}>
            <span className="bico">📤</span> {t.shareScore}
          </button>
          <div className="div" style={{width:"100%"}}/>
          <div className="rlist" style={{width:"100%"}}>
            {gameCats.map(cat => {
              const val=answers[cat]||"", v=validation?.[cat], ok=v?.valid??false;
              return (
                <div key={cat} className={`rrow ${ok?"rv":"ri"}`}>
                  <span className="rico">{ALL_ICONS[cat]}</span>
                  <span className="rcat">{t.catLabels[cat] || cat}</span>
                  <div className="rbody">
                    <div className="rans">{val||<span style={{color:"var(--mute)",fontSize:13}}>—</span>}</div>
                    {v?.reason&&v.reason!=="empty"&&<div className="rwhy">{v.reason}</div>}
                  </div>
                  <span className={`rpts ${ok?"pt-ok":"pt-no"}`}>{ok?"+10":"0"}</span>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:10,width:"100%"}}>
            <button className="btn btn-p" style={{flex:1}} onClick={()=>{ gaEvent("click_play_again", { mode:"solo" }); startSolo(); }}>{t.playAgain}</button>
            <button className="btn btn-g" style={{flex:1}} onClick={goHome}>{t.home}</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── ONLINE GAME ───────────────────────────────────────────────────────────
  if (screen==="online-game") return (
    <div className="G" dir={t.dir}><div className="noise"/>
      <div className="S">
        <div className="ghdr">
          <button className="back" onClick={goHome}>{t.quit}</button>
          <span style={{fontSize:13,color:"var(--mute)"}}>vs {oppName}</span>
        </div>
        <div className="ldisplay">
          <div className="lbg">{letter}</div>
          <div className="lmain">{letter}</div>
          <div className="llbl">{t.currentLetter}</div>
        </div>
        <div className="tbar-wrap"><div className="tbar" style={{width:`${pct}%`,background:tcol}}/></div>
        <div className="tnum" style={{color:tcol}}>{String(timeLeft).padStart(2,"0")}</div>
        {validating ? (
          <div className="vwrap">
            <div className="spin"/>
            <div className="aibadge"><div className="aidot"/> {t.submitting}</div>
            <div style={{color:"var(--mute)",fontSize:13}}>{t.waitingFor} {oppName}…</div>
          </div>
        ) : submitted ? (
          <div style={{textAlign:"center",padding:"24px 12px",color:"var(--ok)",fontSize:14}}>
            {t.submitted} {oppName}…
            <div className="spin" style={{margin:"16px auto 0",width:32,height:32,borderWidth:2}}/>
          </div>
        ) : (
          <>
            {catRows(false)}
            <button type="button" tabIndex={-1} className="btn btn-p" style={{width:"100%",marginTop:8,marginBottom:24}}
              onClick={()=>doSubmit(letterR.current,roomR.current)}>{t.submitAnswers}</button>
          </>
        )}
      </div>
    </div>
  );

  // ── ONLINE SCORE ──────────────────────────────────────────────────────────
  if (screen==="online-score") {
    const hasOppResults = oppVal !== null;
    const won = hasOppResults && myPts > opPts;
    const tie = hasOppResults && myPts === opPts;
    const lost = hasOppResults && myPts < opPts;
    return (
      <div className="G" dir={t.dir}><div className="noise"/>
        {toast && <div className="toast">{toast}</div>}
        <ShareModal/>
        <div className="S">
          <div className="vsscrn">
            <div className="vshdr">{t.results} · {letter}</div>
            <div className={`bnr ${!hasOppResults?"bnr-t":won?"bnr-w":tie?"bnr-t":"bnr-l"}`}>
              <div className={`btxt ${!hasOppResults?"bt-t":won?"bt-w":tie?"bt-t":"bt-l"}`}>
                {!hasOppResults ? "⏳ Waiting for opponent…" : won ? t.youWin : tie ? t.tie : t.youLose}
              </div>
            </div>
            <div className="srow">
              {lang === "he" ? (
                <>
                  <div className="sside"><div className="sslbl">{oppName.toUpperCase()}</div><div className="ssnum so">{opPts}</div></div>
                  <div className="vsmid">{t.vs}</div>
                  <div className="sside"><div className="sslbl">{playerName.toUpperCase()}</div><div className="ssnum sy">{myPts}</div></div>
                </>
              ) : (
                <>
                  <div className="sside"><div className="sslbl">{playerName.toUpperCase()}</div><div className="ssnum sy">{myPts}</div></div>
                  <div className="vsmid">{t.vs}</div>
                  <div className="sside"><div className="sslbl">{oppName.toUpperCase()}</div><div className="ssnum so">{opPts}</div></div>
                </>
              )}
            </div>
            <button className="btn btn-share" style={{width:"100%"}}
              onClick={()=>shareScore(myPts,maxPts,letter,true,won,tie)}>
              <span className="bico">📤</span> {t.shareScore}
            </button>
            <div className="div"/>
            <div className="aibadge" style={{alignSelf:"center",fontSize:12}}><div className="aidot"/> {t.aiValidated}</div>
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
              <button className="btn btn-p" style={{flex:1}}
                onClick={()=>onlineMode==="private" ? rematchSameRoom() : setScreen("online-name")}>
                {t.playAgain}
              </button>
              <button className="btn btn-g" style={{flex:1}} onClick={goHome}>{t.home}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
