"use client";

import { useId } from "react";
import {
  Award, BadgeCheck, Bolt, Calendar, Camera, CheckSquare, Clock, Crown, Flag,
  Flame, Footprints, Globe, Heart, Image as ImageIcon, Images, Leaf, Lock, MapPin,
  Map as MapIcon, Medal, Moon, Mountain, Sparkles, Star, Sun, Trophy, User,
  Users, type LucideIcon,
} from "lucide-react";
import {
  resolveEffect, SIGIL_FRAME, SIGIL_THEME, TIER_DEFAULT_SHAPE, TIER_INDEX,
  type BadgeEffect, type BadgeShape, type BadgeTheme, type BadgeTier,
} from "@/app/(dashboard)/badges/types";

/**
 * The "Sigil" badge preview — a React/SVG mirror of the iOS `BadgeMedallion`
 * (2026-07-02 badge rework), matched pixel-for-pixel via
 * `Vestige-Badge-Sigil-Export/badge-spec.json`.
 *
 * A flat, graphic emblem: a duotone `theme` fill, concentric `tier` rings
 * (ring count = tier index + 1), a tier-climbing `shape`, an `effect` glow, and
 * a glyph. All six axes are live. The dashboard can't render SF Symbols, so the
 * glyph is previewed via a lucide mapping — the exact SF Symbol string still
 * ships in the record and iOS renders it natively.
 *
 * States:
 *   • earned — full artwork.
 *   • progress — a desaturated "blank impression" inside a mint progress ring.
 *   • locked — blank impression + dashed ring + a lock chip (manual grants).
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
  theme?: BadgeTheme;
  tint_hex?: string | null;
  tier: BadgeTier;
  /** Optional — defaults from the tier. */
  shape?: BadgeShape;
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
  const tier = spec.tier;
  const theme = spec.theme ?? "mint";
  const shape = spec.shape ?? TIER_DEFAULT_SHAPE[tier];
  const tint = tintOrTheme(spec.tint_hex, theme);
  const eff = resolveEffect(spec.effect ?? "none", tier);
  const Glyph = GLYPH_LUCIDE[spec.glyph] ?? Award;

  const art = (
    <SigilArt id={id} shape={shape} tier={tier} tint={tint} effect={eff} Glyph={Glyph} px={size} />
  );

  if (earned) return art;

  // Blank "impression" — desaturated shrink of the full artwork.
  const inner = size * 0.74;
  const impression = (
    <div
      style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div style={{ filter: "saturate(0.10) brightness(0.74)" }}>
        <SigilArt id={id} shape={shape} tier={tier} tint={tint} effect="none" Glyph={Glyph} px={inner} />
      </div>
    </div>
  );

  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <StateRing size={size} progress={progress} locked={isManual} id={id} />
      {impression}
      {isManual && <LockChip size={size} />}
    </div>
  );
}

// ── The composed Sigil (frame SVG + lucide glyph overlay + effect glow) ──

function SigilArt({
  id, shape, tier, tint, effect, Glyph, px,
}: {
  id: string;
  shape: BadgeShape;
  tier: BadgeTier;
  tint: string;
  effect: BadgeEffect;
  Glyph: LucideIcon;
  px: number;
}) {
  const isLeg = tier === "legendary";
  const ringCount = TIER_INDEX[tier] + 1;
  const stops = frameStops(tier);

  let shadow = `drop-shadow(0 ${px * 0.05}px ${px * 0.08}px rgba(0,0,0,0.4))`;
  if (effect === "glow") {
    shadow = `drop-shadow(0 ${px * 0.05}px ${px * 0.08}px rgba(0,0,0,0.45)) drop-shadow(0 0 ${px * 0.16}px ${rgba(tint, 0.5)})`;
  } else if (effect === "holographic") {
    shadow = `drop-shadow(0 ${px * 0.05}px ${px * 0.09}px rgba(0,0,0,0.5)) drop-shadow(0 0 ${px * 0.2}px ${rgba(tint, 0.5)}) drop-shadow(0 0 ${px * 0.34}px rgba(167,139,250,0.3))`;
  }

  return (
    <div style={{ width: px, height: px, position: "relative", filter: shadow }}>
      <svg viewBox="0 0 100 100" width={px} height={px} style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id={`${id}-frame`} x1="0" y1="0" x2="1" y2="1">
            {stops.map((s, i) => <stop key={i} offset={`${s.offset * 100}%`} stopColor={s.color} />)}
          </linearGradient>
        </defs>

        {/* Duotone fill + theme stroke. */}
        {shapeEl(shape, { fill: rgba(tint, 0.14), stroke: tint, strokeWidth: 2.4 })}

        {/* Bead frame ring for the seal silhouette. */}
        {shape === "seal" && beadRing(id)}

        {/* Concentric tier rings. */}
        {Array.from({ length: ringCount }, (_, i) => (
          <g key={`r${i}`} transform={`translate(50 50) scale(${1 - 0.13 * (i + 1)}) translate(-50 -50)`}>
            {shapeEl(shape, { fill: "none", stroke: `url(#${id}-frame)`, strokeWidth: i === 0 ? 2 : 1.4, opacity: 0.92 })}
          </g>
        ))}

        {/* Legendary radial burst. */}
        {isLeg && legendaryBurst(id)}
      </svg>

      <GlyphLayer Glyph={Glyph} size={px * 0.34} color={tint} />
    </div>
  );
}

// ── Silhouette geometry (100×100 box, matched to iOS) ──

type Geom =
  | { type: "circle"; r: number }
  | { type: "poly"; points: string }
  | { type: "path"; d: string };

function geom(shape: BadgeShape): Geom {
  switch (shape) {
    case "coin": return { type: "circle", r: 46 };
    case "seal": return { type: "circle", r: 42.5 };
    case "shield": return { type: "path", d: "M50 5 L87 18 Q90 19 90 22 V50 C90 75 73 90 50 96 C27 90 10 75 10 50 V22 Q10 19 13 18 Z" };
    case "hexagon": return { type: "poly", points: polyPts(6, 46, -90) };
    case "rosette": return { type: "poly", points: rosettePts() };
  }
}

type ShapeAttrs = {
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
};

function shapeEl(shape: BadgeShape, attrs: ShapeAttrs) {
  const g = geom(shape);
  const p = { fill: attrs.fill, stroke: attrs.stroke, strokeWidth: attrs.strokeWidth, opacity: attrs.opacity };
  if (g.type === "circle") return <circle cx={50} cy={50} r={g.r} {...p} />;
  if (g.type === "poly") return <polygon points={g.points} {...p} />;
  return <path d={g.d} {...p} />;
}

function beadRing(id: string) {
  return Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * 2 * Math.PI;
    return (
      <circle
        key={`b${i}`}
        cx={50 + 47 * Math.cos(a)}
        cy={50 + 47 * Math.sin(a)}
        r={1.7}
        fill={`url(#${id}-frame)`}
      />
    );
  });
}

function legendaryBurst(id: string) {
  return Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * 2 * Math.PI;
    return (
      <line
        key={`l${i}`}
        x1={50 + 48 * Math.cos(a)} y1={50 + 48 * Math.sin(a)}
        x2={50 + 52 * Math.cos(a)} y2={50 + 52 * Math.sin(a)}
        stroke={`url(#${id}-frame)`}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    );
  });
}

function frameStops(tier: BadgeTier): { offset: number; color: string }[] {
  const f = SIGIL_FRAME[tier];
  if (tier === "legendary") {
    const os = [0, 0.26, 0.5, 0.74, 1];
    return f.map((color, i) => ({ offset: os[i] ?? i / (f.length - 1), color }));
  }
  const os = [0, 0.42, 1];
  return f.map((color, i) => ({ offset: os[i] ?? i / (f.length - 1), color }));
}

function polyPts(n: number, r: number, rot: number): string {
  let s = "";
  for (let i = 0; i < n; i++) {
    const a = ((rot + (360 / n) * i) * Math.PI) / 180;
    s += `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)} `;
  }
  return s.trim();
}

function rosettePts(): string {
  const n = 22;
  let s = "";
  for (let i = 0; i < n; i++) {
    const r = i % 2 ? 40.5 : 47;
    const a = ((-90 + (360 / n) * i) * Math.PI) / 180;
    s += `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)} `;
  }
  return s.trim();
}

// ── State ring + lock ──

function StateRing({
  size, progress, locked, id,
}: {
  size: number;
  progress: number;
  locked: boolean;
  id: string;
}) {
  const circumference = 2 * Math.PI * 45;
  const clamped = Math.max(0.001, Math.min(1, progress));
  return (
    <svg
      viewBox="0 0 100 100" width={size} height={size}
      style={{ position: "absolute", inset: 0 }}
    >
      <defs>
        <linearGradient id={`${id}-prog`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5BE4C3" />
          <stop offset="100%" stopColor="#8FE85B" />
        </linearGradient>
      </defs>
      <circle
        cx="50" cy="50" r="45" fill="none"
        stroke="rgba(255,255,255,0.10)" strokeWidth="3.4"
        strokeDasharray={locked ? "1.5 5" : undefined}
      />
      {!locked && (
        <circle
          cx="50" cy="50" r="45" fill="none"
          stroke={`url(#${id}-prog)`} strokeWidth="3.4" strokeLinecap="round"
          strokeDasharray={`${(clamped * circumference).toFixed(1)} ${circumference.toFixed(1)}`}
          transform="rotate(-90 50 50)"
        />
      )}
    </svg>
  );
}

function LockChip({ size }: { size: number }) {
  const ls = size * 0.3;
  return (
    <div
      style={{
        position: "absolute", bottom: -2, left: "50%", transform: "translateX(-50%)",
        width: ls, height: ls, borderRadius: "50%",
        background: "rgba(13,22,32,0.92)", border: "1px solid rgba(255,255,255,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
      }}
    >
      <Lock size={ls * 0.5} color="#9DA9B6" strokeWidth={2.4} />
    </div>
  );
}

/** Centred glyph overlay — the SF Symbol is previewed via its lucide mapping. */
function GlyphLayer({ Glyph, size, color }: { Glyph: LucideIcon; size: number; color: string }) {
  return (
    <div
      style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <Glyph size={size} color={color} strokeWidth={2.2} absoluteStrokeWidth />
    </div>
  );
}

/** Theme colour by default; honour a valid 6-digit `tint_hex` override. */
function tintOrTheme(hex: string | null | undefined, theme: BadgeTheme): string {
  if (hex) {
    const clean = hex.replace(/^#/, "");
    if (/^[0-9a-fA-F]{6}$/.test(clean)) return `#${clean}`;
  }
  return SIGIL_THEME[theme];
}

function rgba(hex: string, a: number): string {
  const clean = hex.replace(/^#/, "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
