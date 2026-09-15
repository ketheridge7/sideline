"use client";

import { useState } from "react";
import { FieldCanvas } from "@/components/mockups/field-canvas";
import { cn } from "@/lib/cn";
import { OVERLAY_PRESETS, type OverlayPresetId } from "@/lib/demo";

const PRESET_IDS = ["1", "2", "3", "4", "5"] as const;

type Box = { top: string; left: string; height: string; width: string };

function boxesFor(id: OverlayPresetId): { you: Box; them: Box } {
  switch (id) {
    case "1":
      return {
        you: { top: "8%", left: "2%", height: "78%", width: "16%" },
        them: { top: "8%", left: "82%", height: "78%", width: "16%" },
      };
    case "2":
      return {
        you: { top: "6%", left: "2%", height: "42%", width: "16%" },
        them: { top: "6%", left: "82%", height: "42%", width: "16%" },
      };
    case "3":
      return {
        you: { top: "50%", left: "2%", height: "42%", width: "16%" },
        them: { top: "50%", left: "82%", height: "42%", width: "16%" },
      };
    case "4":
      return {
        you: { top: "8%", left: "2%", height: "40%", width: "18%" },
        them: { top: "50%", left: "2%", height: "40%", width: "18%" },
      };
    case "5":
      return {
        you: { top: "8%", left: "2%", height: "38%", width: "18%" },
        them: { top: "52%", left: "80%", height: "38%", width: "18%" },
      };
    default: {
      const _never: never = id;
      return _never;
    }
  }
}

function RailGhost({ box, tone }: { box: Box; tone: "you" | "them" }) {
  return (
    <div
      className={cn(
        "absolute rounded-[2px] border",
        tone === "you" ? "border-you/70 bg-you/10" : "border-them/50 bg-white/5",
      )}
      style={box}
    />
  );
}

export function StudioPreview() {
  const [preset, setPreset] = useState<OverlayPresetId>("1");
  const boxes = boxesFor(preset);
  const meta = OVERLAY_PRESETS[preset];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Overlay presets">
        {PRESET_IDS.map((id) => {
          const active = preset === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPreset(id)}
              className={cn(
                "min-w-10 cursor-pointer border px-3 py-1.5 font-cond text-sm font-bold",
                active ? "border-you bg-you/15 text-you" : "border-line text-muted hover:text-text",
              )}
            >
              {id}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted">
        Preset {preset} · {meta.placement}. {meta.hint}
      </p>
      <FieldCanvas className="aspect-video rounded-md" dim>
        <div className="absolute inset-[22%_22%_14%_22%] border border-dashed border-white/10" />
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-cond text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
          Live video
        </p>
        <RailGhost box={boxes.you} tone="you" />
        <RailGhost box={boxes.them} tone="them" />
      </FieldCanvas>
    </div>
  );
}
