import { CompanionSection } from "@/components/sections/companion";
import { ConnectSection } from "@/components/sections/connect";
import { DownloadSection } from "@/components/sections/download";
import { HashmarkSection } from "@/components/sections/hashmark";
import { Hero } from "@/components/sections/hero";
import { Problem } from "@/components/sections/problem";
import { ProofStrip } from "@/components/sections/proof-strip";
import { StudioSection } from "@/components/sections/studio";
import { SurfacesSection } from "@/components/sections/surfaces";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { StickyDownload } from "@/components/sticky-download";

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main id="main">
        <Hero />
        <ProofStrip />
        <Problem />
        <CompanionSection />
        <HashmarkSection />
        <StudioSection />
        <SurfacesSection />
        <ConnectSection />
        <DownloadSection />
      </main>
      <SiteFooter />
      <StickyDownload />
    </>
  );
}
