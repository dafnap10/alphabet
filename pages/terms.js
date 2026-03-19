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
  title: "Terms of Service",
  date: "Last updated: March 2026",
  sections: [
    {
      h: "1. Acceptance of Terms",
      p: `By accessing or using Alphabet Game at www.alphabetush.com, you agree to be bound by these Terms of Service. If you do not agree, please do not use the game.`
    },
    {
      h: "2. Description of Service",
      p: `Alphabet Game is a free online word game where players fill categories with words starting with a given letter within 60 seconds. Answers are validated using Wikipedia and Wikidata APIs. The game is provided "as is" and free of charge.`
    },
    {
      h: "3. Acceptable Use",
      bullets: [
        "You may use the game for personal, non-commercial entertainment",
        "You may not attempt to hack, reverse-engineer, or disrupt the service",
        "You may not use automated bots or scripts to play the game",
        "You may not use the service for any illegal purpose"
      ]
    },
    {
      h: "4. Intellectual Property",
      p: `The game design, code, and branding are owned by Alphabet Game. Answer validation is powered by Wikipedia content licensed under CC BY-SA 3.0. We do not claim ownership over Wikipedia content.`
    },
    {
      h: "5. Disclaimer of Warranties",
      p: `The game is provided "as is" without any warranty. We do not guarantee that the AI validation is always accurate. Scores and results are for entertainment purposes only. We are not responsible for incorrect validations or technical errors.`
    },
    {
      h: "6. Limitation of Liability",
      p: `To the maximum extent permitted by law, Alphabet Game shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.`
    },
    {
      h: "7. Third-Party Services",
      p: `The game uses Wikipedia/Wikidata (CC BY-SA 3.0), Google Analytics, Supabase, and Vercel. Use of these services is subject to their respective terms and privacy policies.`
    },
    {
      h: "8. Changes to Terms",
      p: `We reserve the right to modify these terms at any time. Continued use of the game after changes constitutes acceptance of the new terms.`
    },
    {
      h: "9. Governing Law",
      p: `These terms are governed by the laws of Israel. Any disputes shall be resolved in Israeli courts.`
    },
    {
      h: "10. Contact",
      p: `For questions about these terms: info@alphabetush.com`
    }
  ]
};

const HE = {
  title: "תנאי שימוש",
  date: "עדכון אחרון: מרץ 2026",
  sections: [
    {
      h: "1. קבלת התנאים",
      p: `בגישה לאתר www.alphabetush.com ושימוש במשחק האלפבית, אתה מסכים לתנאי שימוש אלה. אם אינך מסכים, אנא אל תשתמש במשחק.`
    },
    {
      h: "2. תיאור השירות",
      p: `משחק האלפבית הוא משחק מילים מקוון חינמי שבו שחקנים ממלאים קטגוריות במילים שמתחילות באות נתונה תוך 60 שניות. התשובות מאומתות באמצעות ויקיפדיה ו-Wikidata. המשחק מסופק "כפי שהוא" וללא תשלום.`
    },
    {
      h: "3. שימוש מותר",
      bullets: [
        "מותר להשתמש במשחק לבידור אישי, לא מסחרי",
        "אסור לנסות לפרוץ, לבצע הנדסה לאחור, או לשבש את השירות",
        "אסור להשתמש בבוטים אוטומטיים או סקריפטים לשחק",
        "אסור להשתמש בשירות למטרות בלתי חוקיות"
      ]
    },
    {
      h: "4. קניין רוחני",
      p: `עיצוב המשחק, הקוד והמיתוג שייכים למשחק האלפבית. אימות התשובות מופעל על ידי תוכן ויקיפדיה המורשה תחת CC BY-SA 3.0. איננו טוענים לבעלות על תוכן ויקיפדיה.`
    },
    {
      h: "5. הגבלת אחריות לאחריות",
      p: `המשחק מסופק "כפי שהוא" ללא כל אחריות. איננו מבטיחים שאימות ה-AI תמיד מדויק. ניקוד ותוצאות הם למטרות בידור בלבד. איננו אחראים לאימותים שגויים או שגיאות טכניות.`
    },
    {
      h: "6. הגבלת חבות",
      p: `במידה המרבית המותרת על פי חוק, משחק האלפבית לא יהיה אחראי לכל נזק עקיף, מקרי או תוצאתי הנובע מהשימוש שלך בשירות.`
    },
    {
      h: "7. שירותי צד שלישי",
      p: `המשחק משתמש בויקיפדיה/Wikidata (CC BY-SA 3.0), Google Analytics, Supabase ו-Vercel. השימוש בשירותים אלה כפוף לתנאים ומדיניות הפרטיות שלהם.`
    },
    {
      h: "8. שינויים בתנאים",
      p: `אנו שומרים לעצמנו את הזכות לשנות תנאים אלה בכל עת. המשך השימוש במשחק לאחר שינויים מהווה הסכמה לתנאים החדשים.`
    },
    {
      h: "9. דין חל",
      p: `תנאים אלה כפופים לחוקי מדינת ישראל. כל מחלוקת תידון בבתי המשפט הישראליים.`
    },
    {
      h: "10. יצירת קשר",
      p: `לשאלות בנושא תנאים אלה: info@alphabetush.com`
    }
  ]
};

export default function Terms() {
  const [lang, setLang] = useState("en");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("lang");
    if (p === "he" || p === "en") setLang(p);
    else {
      const stored = window.localStorage.getItem("alphabetush_lang");
      if (stored === "he") setLang("he");
    }
  }, []);
  const content = lang === "he" ? HE : EN;

  return (
    <>
      <Head>
        <title>{lang === "he" ? "תנאי שימוש — משחק האלפבית" : "Terms of Service — Alphabet Game"}</title>
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
