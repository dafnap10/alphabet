import { useEffect } from "react";
import Head from "next/head";

export default function HeLanding() {
  useEffect(() => {
    window.location.replace("/?lang=he");
  }, []);

  return (
    <>
      <Head>
        <title>משחק האלפבית — סטופ אונליין | AI שופט תשובות</title>
        <meta name="description" content="משחק אלפבית (סטופ) אונליין בעברית — מלא 7 קטגוריות במילים שמתחילות באותה אות תוך 60 שניות. ה-AI שופט את התשובות לפי ויקיפדיה. חינמי, מיידי, ללא הרשמה." />
        <meta name="keywords" content="משחק אלפבית, סטופ אונליין, משחק מילים בעברית, משחק קטגוריות, סטופ, זאפ, משחק AI, אלפבית, מילים, קטגוריות, משחק חינמי" />
        <meta property="og:title" content="משחק האלפבית — סטופ אונליין" />
        <meta property="og:description" content="מלא 7 קטגוריות תוך 60 שניות. ה-AI שופט את התשובות שלך!" />
        <meta property="og:url" content="https://alphabetush.vercel.app/he" />
        <meta property="og:image" content="https://alphabetush.vercel.app/og.png" />
        <meta property="og:locale" content="he_IL" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="משחק האלפבית — סטופ אונליין" />
        <meta name="twitter:description" content="מלא 7 קטגוריות תוך 60 שניות. שופט AI. חינמי!" />
        <meta name="twitter:image" content="https://alphabetush.vercel.app/og.png" />
        <link rel="canonical" href="https://alphabetush.vercel.app/he" />
        <link rel="alternate" hrefLang="he" href="https://alphabetush.vercel.app/he" />
        <link rel="alternate" hrefLang="en" href="https://alphabetush.vercel.app/" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "משחק האלפבית",
            "alternateName": "סטופ אונליין",
            "url": "https://alphabetush.vercel.app/he",
            "description": "מלא 7 קטגוריות במילים שמתחילות באותה אות תוך 60 שניות. ה-AI שופט את התשובות.",
            "applicationCategory": "GameApplication",
            "operatingSystem": "Web",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "ILS" },
            "inLanguage": "he"
          })}}
        />
      </Head>
      <div style={{
        minHeight: "100vh", background: "#0a0a0f", color: "#f0f0ff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "sans-serif", fontSize: 18, direction: "rtl"
      }}>
        <p>טוען משחק...</p>
      </div>
    </>
  );
}
