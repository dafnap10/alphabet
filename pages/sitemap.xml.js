export default function Sitemap() {}

export async function getServerSideProps({ res }) {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://www.alphabetush.com/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://www.alphabetush.com/"/>
    <xhtml:link rel="alternate" hreflang="he" href="https://www.alphabetush.com/he"/>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.alphabetush.com/he</loc>
    <xhtml:link rel="alternate" hreflang="he" href="https://www.alphabetush.com/he"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://www.alphabetush.com/"/>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;

  res.setHeader("Content-Type", "text/xml");
  res.write(sitemap);
  res.end();

  return { props: {} };
}
