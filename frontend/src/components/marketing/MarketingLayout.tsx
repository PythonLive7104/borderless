import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { trackPageView } from "../../lib/analytics";
import JsonLd from "./JsonLd";
import { graph, organization, website } from "../../lib/schema";

// Who publishes this site, on every marketing page. Page-specific schema
// (FAQs, articles, offers) is added by the pages themselves and references
// these two by @id rather than restating them.
const SITE_JSONLD = graph(organization(), website());

export default function MarketingLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    // After the scroll, so document.title has been set by the page's useSeo.
    trackPageView(pathname);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <JsonLd data={SITE_JSONLD} />
      <Navbar />
      <main className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  );
}
