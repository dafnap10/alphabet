import Head from "next/head";
import { useState, useEffect } from "react";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0a0a0f;--surf:#12121a;--brd:#2a2a3d;--acc:#e8ff47;--txt:#f0f0ff;--mute:#6b6b8a}
body{background:var(--bg);color:var(--txt);font-family:'DM Sans',sans-serif;line-height:1.7}
.wrap{max-width:720px;margin:0 auto;padding:40px 20px 80px}
h1{font-size:28px;font-weight:700;margin-bottom:8px;color:var(--acc)}
h2{font-size:18px;font-weight:600;margin:32px 0 8px;color:var(--txt)}
p{color:#c0c0d8;margin-bottom:12px;font-size:15px}
ul{color:#c0c0d8;margin:0 0 12px 20px;font-size:15px}
ul li{margin-bottom:6px}
a{color:var(--acc);text-decoration:none}
a:hover{text-decoration:underline}
.back-btn{display:inline-flex;align-items:center;gap:6px;color:var(--mute);font-size:14px;cursor:pointer;background:none;border:none;margin-bottom:32px;font-family:'DM Sans',sans-serif}
.back-btn:hover{color:var(--txt)}
.date{color:var(--mute);font-size:13px;margin-bottom:32px}
.lang-switch{display:flex;gap:10px;margin-bottom:24px}
.lang-btn{background:none;border:1px solid var(--brd);color:var(--mute);border-radius:20px;padding:4px 12px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif}
.lang-btn.active{border-color:var(--acc);color:var(--acc)}
`;

const EN = {
  title: "Privacy Policy",
  date: "Last updated: March 2026",
  sections: [
    {
      h: "1. Introduction",
      p: `Alphabet Game ("we", "our", "us") operates the website www.alphabetush.com. This Privacy Policy explains how we collect, use, and protect information when you use our game.`
    },
    {
      h: "2. Information We Collect",
      bullets: [
        "Anonymous player ID stored in your browser's localStorage (randomly generated, not linked to any personal identity)",
        "Your in-game answers and scores during gameplay",
        "Usage data collected by Google Analytics (pages visited, session duration, device type, approximate location)",
        "No name, email, or personal account is required to play"
      ]
    },
    {
      h: "3. Google Analytics",
      p: `We use Google Analytics to understand how players use our game. Google Analytics collects anonymized data including pages viewed, time on site, and general geographic region. Google may use this data in accordance with their own Privacy Policy: https://policies.google.com/privacy. You can opt out of Google Analytics tracking by installing the Google Analytics Opt-out Browser Add-on.`
    },
    {
      h: "4. Cookies",
      p: `We use localStorage (not cookies) to store your anonymous player ID on your device. Google Analytics uses its own cookies. No tracking cookies are set by us directly.`
    },
    {
      h: "5. Third-Party Services",
      bullets: [
        "Wikipedia & Wikidata APIs — used to validate answers. No personal data is sent to Wikipedia.",
        "Supabase — used to store anonymous game sessions and matchmaking data. Data is stored securely.",
        "Google Analytics — see section 3.",
        "Vercel — our hosting provider. May collect server logs including IP addresses."
      ]
    },
    {
      h: "6. Data Retention",
      p: `Anonymous game data (answers, scores) is stored temporarily in our database and may be deleted periodically. We do not retain any personally identifiable information.`
    },
    {
      h: "7. Children's Privacy",
      p: `Our game is suitable for general audiences. We do not knowingly collect personal information from children under 13. If you believe a child has provided personal information, please contact us.`
    },
    {
      h: "8. Your Rights",
      p: `Since we do not collect personally identifiable information, there is no personal data to request, correct, or delete. If you have concerns, please contact us.`
    },
    {
      h: "9. Changes to This Policy",
      p: `We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated date.`
    },
    {
      h: "10. Contact",
      p: `For any privacy questions, contact us at: info@alphabetush.com`
    }
  ]
};

const HE = {
  title: "מדיניות פרטיות",
  date: "עדכון אחרון: מרץ 2026",
  sections: [
    {
      h: "1. מבוא",
      p: `משחק האלפבית ("אנחנו") מפעיל את האתר www.alphabetush.com. מדיניות פרטיות זו מסבירה כיצד אנו אוספים, משתמשים ומגנים על מידע בעת שימושך במשחק.`
    },
    {
      h: "2. מידע שאנו אוספים",
      bullets: [
        "מזהה שחקן אנונימי השמור ב-localStorage של הדפדפן שלך (נוצר אקראית, לא מקושר לזהות אישית)",
        "תשובות וניקוד במהלך המשחק",
        "נתוני שימוש שנאספים על ידי Google Analytics (דפים שביקרת, משך שהייה, סוג מכשיר, מיקום כללי)",
        "אין צורך בשם, אימייל או חשבון אישי כדי לשחק"
      ]
    },
    {
      h: "3. Google Analytics",
      p: `אנו משתמשים ב-Google Analytics להבנת אופן השימוש במשחק. Google Analytics אוסף נתונים מאונונימיים כולל דפים שנצפו, זמן באתר ואזור גיאוגרפי כללי. ניתן לבטל את המעקב של Google Analytics על ידי התקנת תוסף הדפדפן של Google Analytics Opt-out.`
    },
    {
      h: "4. עוגיות (Cookies)",
      p: `אנו משתמשים ב-localStorage (לא עוגיות) לשמירת מזהה השחקן האנונימי שלך. Google Analytics משתמש בעוגיות משלו. אנו לא מגדירים עוגיות מעקב ישירות.`
    },
    {
      h: "5. שירותי צד שלישי",
      bullets: [
        "ויקיפדיה ו-Wikidata — לאימות תשובות. לא נשלח מידע אישי לויקיפדיה.",
        "Supabase — לאחסון הפעלות משחק אנונימיות ונתוני מאצ'מייקינג. הנתונים מאוחסנים בצורה מאובטחת.",
        "Google Analytics — ראה סעיף 3.",
        "Vercel — ספק האחסון שלנו. עשוי לאסוף לוגי שרת כולל כתובות IP."
      ]
    },
    {
      h: "6. שמירת נתונים",
      p: `נתוני משחק אנונימיים (תשובות, ניקוד) מאוחסנים זמנית במסד הנתונים שלנו ועשויים להימחק מעת לעת. אנו לא שומרים מידע מזהה אישי.`
    },
    {
      h: "7. פרטיות ילדים",
      p: `המשחק שלנו מתאים לקהל הרחב. אנו לא אוספים ביודעין מידע אישי מילדים מתחת לגיל 13. אם אתה סבור שילד מסר מידע אישי, אנא צור איתנו קשר.`
    },
    {
      h: "8. הזכויות שלך",
      p: `מאחר שאנו לא אוספים מידע מזהה אישי, אין נתונים אישיים לבקש, לתקן או למחוק. אם יש לך חששות, אנא פנה אלינו.`
    },
    {
      h: "9. שינויים במדיניות",
      p: `אנו עשויים לעדכן מדיניות פרטיות זו מעת לעת. שינויים יפורסמו בדף זה עם תאריך עדכון מחודש.`
    },
    {
      h: "10. יצירת קשר",
      p: `לשאלות בנושא פרטיות, צרו קשר: info@alphabetush.com`
    }
  ]
};

export default function Privacy() {
  const [lang, setLang] = useState("en");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("lang");
    if (p === "he" || p === "en") setLang(p);
    else {
      // Check localStorage from main game
      const stored = window.localStorage.getItem("alphabetush_lang");
      if (stored === "he") setLang("he");
    }
  }, []);
  const content = lang === "he" ? HE : EN;

  return (
    <>
      <Head>
        <title>{lang === "he" ? "מדיניות פרטיות — משחק האלפבית" : "Privacy Policy — Alphabet Game"}</title>
        <meta name="robots" content="index, follow" />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </Head>
      <div className="wrap" dir={lang === "he" ? "rtl" : "ltr"}>
        <button className="back-btn" onClick={() => window.history.back()}>← {lang === "he" ? "חזרה" : "Back"}</button>

        <div className="lang-switch">
          <button className={`lang-btn${lang==="he"?" active":""}`} onClick={()=>setLang("he")}>עברית</button>
          <button className={`lang-btn${lang==="en"?" active":""}`} onClick={()=>setLang("en")}>English</button>
        </div>

        <h1>{content.title}</h1>
        <div className="date">{content.date}</div>

        {content.sections.map((s, i) => (
          <div key={i}>
            <h2>{s.h}</h2>
            {s.p && <p>{s.p}</p>}
            {s.bullets && <ul>{s.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>}
          </div>
        ))}
      </div>
    </>
  );
}
