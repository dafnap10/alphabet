import "../styles/globals.css";
import Head from "next/head";
export default function App({ Component, pageProps }) {
  const siteUrl = "https://alphabetush.vercel.app/";
  const title = "Alphabetush — Alphabet Game";
  const description = "Play the Alphabet (Stop) word game solo or with friends. AI + Wikipedia validation.";
  const ogImage = `${siteUrl}og.png`;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />

        {/* Open Graph (WhatsApp/Facebook link previews) */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Alphabetush" />
        <meta property="og:url" content={siteUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />

        <link rel="canonical" href={siteUrl} />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
