import {
  FOUNDER,
  SITE_ALIASES,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/seo/site";

export function SiteJsonLd() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        alternateName: [...SITE_ALIASES],
        description: SITE_DESCRIPTION,
        inLanguage: "en",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#app`,
        name: SITE_NAME,
        alternateName: [...SITE_ALIASES],
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: SITE_URL,
        description: SITE_TAGLINE,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        creator: { "@id": `${SITE_URL}/#person` },
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        alternateName: [...SITE_ALIASES],
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        founder: { "@id": `${SITE_URL}/#person` },
        sameAs: ["https://github.com/akinolaolayemi667/holarchat"],
      },
      {
        "@type": "Person",
        "@id": `${SITE_URL}/#person`,
        name: FOUNDER.name,
        alternateName: [...FOUNDER.alternateName],
        jobTitle: FOUNDER.jobTitle,
        url: `${SITE_URL}/about`,
        worksFor: { "@id": `${SITE_URL}/#organization` },
        sameAs: [...FOUNDER.sameAs],
        description:
          "Akinola Olayemi is the founder of Holarchat (Hola / RelayChat), a real-time messaging and WebRTC file-sharing product.",
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
