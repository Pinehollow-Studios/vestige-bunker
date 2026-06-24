"use client";

import { useId } from "react";
import {
  Award, BadgeCheck, Bolt, Calendar, Camera, CheckSquare, Clock, Crown, Flag,
  Flame, Footprints, Globe, Heart, Image as ImageIcon, Images, Leaf, Lock, MapPin,
  Map as MapIcon, Medal, Moon, Mountain, Sparkles, Star, Sun, Trophy, User,
  Users, type LucideIcon,
} from "lucide-react";
import {
  GLYPH_MINT, PLATE_COLOR, TIER_RIM_WIDTH, TIER_RING,
  type BadgeEffect, type BadgeShape, type BadgeTheme, type BadgeTier,
} from "@/app/(dashboard)/badges/types";

/**
 * The engraved-seal badge preview — a React/SVG mirror of the iOS
 * `BadgeMedallion` (2026-06-17 badge rework). One uniform circular seal for
 * the whole catalogue: a flat **brushed-metal tier rim** (the only thing that
 * varies by tier) around a flat **deep-slate engraved plate** with a single
 * **mint glyph** centred and a fine hairline ring pressed into the plate.
 *
 * The old glossy medallion (gradient faces, white sheen, holographic /
 * metallic effects, five shapes, nine-colour theme palette) is gone. The
 * `theme` / `shape` / `effect` fields on `MedallionSpec` are accepted for
 * compatibility but deliberately ignored — only `tier`, `glyph` and the
 * optional `tint_hex` are read, exactly as iOS does.
 *
 * States:
 *   • earned — metal tier rim + slate plate + mint (or tinted) glyph.
 *   • locked — a "blank impression": no metal rim, a dashed faint edge, a
 *     ghost glyph, and either a mint progress ring (count badges) or a lock
 *     (manual / awarded badges).
 */

/** SF Symbol name → lucide preview icon (iOS renders the real SF Symbol). */
const GLYPH_LUCIDE: Record<string, LucideIcon> = {
  rosette: Award,
  "trophy.fill": Trophy,
  "crown.fill": Crown,
  "star.fill": Star,
  "flag.fill": Flag,
  "flag.2.crossed.fill": Flag,
  "flag.checkered": Flag,
  "figure.golf": Footprints,
  "map.fill": MapIcon,
  "mappin.circle.fill": MapPin,
  "globe.europe.africa.fill": Globe,
  checklist: CheckSquare,
  "checkmark.seal.fill": BadgeCheck,
  "medal.fill": Medal,
  "100.circle.fill": Award,
  "camera.fill": Camera,
  "photo.fill": ImageIcon,
  "photo.stack.fill": Images,
  "person.fill": User,
  "person.2.fill": Users,
  "person.3.fill": Users,
  "person.3.sequence.fill": Users,
  sparkles: Sparkles,
  "bolt.fill": Bolt,
  "flame.fill": Flame,
  "heart.fill": Heart,
  "leaf.fill": Leaf,
  "sun.max.fill": Sun,
  "moon.stars.fill": Moon,
  "mountain.2.fill": Mountain,
  calendar: Calendar,
  "clock.fill": Clock,
  "shield.fill": Award,
};

export type MedallionSpec = {
  glyph: string;
  /** @deprecated ignored by the seal renderer — kept for compatibility. */
  theme?: BadgeTheme;
  tint_hex?: string | null;
  tier: BadgeTier;
  /** @deprecated ignored by the seal renderer. */
  shape?: BadgeShape;
  /** @deprecated ignored by the seal renderer. */
  effect?: BadgeEffect;
};

export function BadgeMedallion({
  spec,
  size = 96,
  earned = true,
  progress = 0,
  isManual = false,
}: {
  spec: MedallionSpec;
  size?: number;
  earned?: boolean;
  progress?: number;
  /** Manual / awarded badges show a lock when locked, not a progress ring. */
  isManual?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const Glyph = GLYPH_LUCIDE[spec.glyph] ?? Award;
  const glyphColor = tintHexOrMint(spec.tint_hex);

  // SVG works in a 0..100 box; rim width tracks the tier, matching iOS's
  // `max(2.5, size * 0.075)` floor expressed as a fraction of the box.
  const rim = Math.max(2.5 / size, TIER_RIM_WIDTH[spec.tier]) * 100;
  const glyphPx = size * 0.34;

  if (earned) {
    const ring = TIER_RING[spec.tier];
    return (
      <div style={{ width: size, height: size, position: "relative" }}>
        <svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          style={{
            display: "block",
            filter: `drop-shadow(0 ${size * 0.03}px ${size * 0.05}px rgba(0,0,0,0.32))`,
          }}
        >
          <defs>
            <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
              {ring.map((c, i) => (
                <stop key={i} offset={`${(i / (ring.length - 1)) * 100}%`} stopColor={c} />
              ))}
            </linearGradient>
          </defs>

          {/* Brushed-metal tier rim — the only thing that varies by tier. */}
          <circle cx="50" cy="50" r="49.5" fill={`url(#${id}-rim)`} />
          <circle
            cx="50" cy="50" r="49"
            fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="0.75"
          />

          {/* Engraved slate plate inset inside the rim. */}
          <circle cx="50" cy="50" r={50 - rim} fill={PLATE_COLOR} />
          {/* Outer pressed shadow edge of the plate. */}
          <circle
            cx="50" cy="50" r={50 - rim}
            fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="0.75"
          />
          {/* Fine hairline ring pressed into the plate. */}
          <circle
            cx="50" cy="50" r={50 - rim - rim * 0.55}
            fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1"
          />
        </svg>

        {/* Mint (or tinted) glyph. */}
        <GlyphLayer Glyph={Glyph} size={glyphPx} color={glyphColor} />
      </div>
    );
  }

  // Locked — a "blank impression": debossed empty slot.
  const clamped = Math.max(0.001, Math.min(1, progress));
  // r=46, circumference ≈ 289 (matches the iOS ring proportion).
  const circumference = 2 * Math.PI * 46;
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: "block" }}>
        {/* Sunken empty face inside the rim band. */}
        <circle cx="50" cy="50" r={50 - rim} fill={PLATE_COLOR} fillOpacity="0.45" />
        {/* Dashed faint edge where the metal rim would be. */}
        <circle
          cx="50" cy="50" r={50 - rim}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
      </svg>

      {/* Ghost of the glyph — faintest mint impression of what goes here. */}
      <GlyphLayer Glyph={Glyph} size={glyphPx} color={GLYPH_MINT} opacity={0.1} />

      {isManual ? (
        // Manual / awarded badges — a quiet lock, no progress.
        <div
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Lock size={size * 0.2} color="#5C7187" strokeWidth={2.4} />
        </div>
      ) : (
        // Count badges — a mint progress ring showing % to target.
        <svg
          viewBox="0 0 100 100" width={size} height={size}
          style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
        >
          <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
          <circle
            cx="50" cy="50" r="46" fill="none"
            stroke={GLYPH_MINT} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${clamped * circumference} ${circumference}`}
          />
        </svg>
      )}
    </div>
  );
}

/** Centred glyph overlay — the SF Symbol is previewed via its lucide mapping. */
function GlyphLayer({
  Glyph, size, color, opacity = 1,
}: {
  Glyph: LucideIcon;
  size: number;
  color: string;
  opacity?: number;
}) {
  return (
    <div
      style={{
        position: "absolute", inset: 0, opacity,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <Glyph size={size} color={color} strokeWidth={2.2} absoluteStrokeWidth />
    </div>
  );
}

/** Mint glyph by default; honour a valid 6-digit `tint_hex` override. */
function tintHexOrMint(hex?: string | null): string {
  if (!hex) return GLYPH_MINT;
  const clean = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return GLYPH_MINT;
  return `#${clean}`;
}
