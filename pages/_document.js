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
        {/* Block flash of unstyled content: dark bg immediately, hide content until hydrated */}
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
