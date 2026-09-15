import { FieldCanvas } from "@/components/mockups/field-canvas";
import { HashmarkOverlay } from "@/components/mockups/hashmark-overlay";
import { SectionEyebrow, SectionLead, SectionTitle } from "@/components/ui";

export function HashmarkSection() {
  return (
    <section id="overlay" className="py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <SectionEyebrow>Hashmark overlay</SectionEyebrow>
        <SectionTitle>
          Frosted type on the rails.
          <br />
          Empty center for the game.
        </SectionTitle>
        <SectionLead>
          Always-on-top HUD for Windows. Modules sit on the sidelines so live video stays the
          product. No smoke wash, no card, no crawler — just names, scores, and starter rails.
        </SectionLead>
      </div>
      <div className="mx-auto mt-12 max-w-6xl px-5 sm:px-6">
        <div className="overflow-hidden rounded-xl border border-line">
          <FieldCanvas className="aspect-[16/9] min-h-[320px]">
            <HashmarkOverlay />
          </FieldCanvas>
          <p className="border-t border-line bg-card py-3 text-center font-cond text-xs font-bold uppercase tracking-[0.2em] text-muted">
            Sunday Tape · Frost HUD · Empty center
          </p>
        </div>
      </div>
    </section>
  );
}
