import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#0a0a0f" />

        {/* Primary SEO */}
        <meta name="description" content="Alphabet Game – Fill 7 categories with words starting with the same letter in 60 seconds. AI-judged. Play solo or challenge a friend online!" />
        <meta name="keywords" content="alphabet game, word game, categories game, stop game, AI word game, online word game, משחק אלפבית, משחק מילים, סטופ, משחק קטגוריות" />
        <meta name="author" content="Alphabetush" />
        <meta name="robots" content="index, follow" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://alphabetush.vercel.app/" />
        <meta property="og:title" content="Alphabet Game – AI Word Game" />
        <meta property="og:description" content="Fill 7 categories in 60 seconds. AI-judged answers. Play free!" />
        <meta property="og:image" content="https://alphabetush.vercel.app/og.png" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Alphabet Game – AI Word Game" />
        <meta name="twitter:description" content="Fill 7 categories in 60 seconds. AI-judged. Free to play!" />
        <meta name="twitter:image" content="https://alphabetush.vercel.app/og.png" />

        {/* Canonical + hreflang */}
        <link rel="canonical" href="https://alphabetush.vercel.app/" />
        <link rel="alternate" hrefLang="en" href="https://alphabetush.vercel.app/" />
        <link rel="alternate" hrefLang="he" href="https://alphabetush.vercel.app/he" />
        <link rel="alternate" hrefLang="x-default" href="https://alphabetush.vercel.app/" />

        {/* Structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "Alphabet Game",
            "url": "https://alphabetush.vercel.app/",
            "description": "Fill 7 categories with words starting with the same letter in 60 seconds. AI-judged answers.",
            "applicationCategory": "GameApplication",
            "operatingSystem": "Web",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
            "inLanguage": ["en", "he"]
          })}}
        />

        <style dangerouslySetInnerHTML={{ __html:
          `html{background:#0a0a0f}body{background:#0a0a0f;margin:0}#__next{opacity:0;transition:opacity 0.15s}`
        }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
