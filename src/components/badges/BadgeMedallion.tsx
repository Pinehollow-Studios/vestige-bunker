"use client";

import { useId } from "react";
import {
  Award, BadgeCheck, Bolt, Calendar, Camera, CheckSquare, Clock, Crown, Flag,
  Flame, Footprints, Globe, Heart, Image as ImageIcon, Images, Leaf, MapPin,
  Map as MapIcon, Medal, Moon, Mountain, Sparkles, Star, Sun, Trophy, User,
  Users, type LucideIcon,
} from "lucide-react";
import {
  THEME_COLORS, THEME_INK, TIER_RING,
  type BadgeEffect, type BadgeShape, type BadgeTheme, type BadgeTier,
} from "@/app/(dashboard)/badges/types";

/** SF Symbol name → lucide preview icon (the app renders the real symbol). */
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
  theme: BadgeTheme;
  tint_hex?: string | null;
  tier: BadgeTier;
  shape: BadgeShape;
  effect: BadgeEffect;
};

export function BadgeMedallion({
  spec,
  size = 96,
  earned = true,
  progress = 0,
}: {
  spec: MedallionSpec;
  size?: number;
  earned?: boolean;
  progress?: number;
}) {
  const id = useId().replace(/:/g, "");
  const faceColors = tint(spec.tint_hex) ?? THEME_COLORS[spec.theme];
  const ink = THEME_INK[spec.theme];
  const ring = TIER_RING[spec.tier];
  const Glyph = GLYPH_LUCIDE[spec.glyph] ?? Award;

  const path = shapePath(spec.shape);
  const facePath = shapePath(spec.shape, 0.86); // inset for the frame border

  const glow =
    spec.effect === "glow"
      ? `drop-shadow(0 0 ${size * 0.12}px ${faceColors[0]}aa)`
      : undefined;

  const body = (
    <div
      style={{ width: size, height: size, position: "relative", filter: glow }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: "block" }}>
        <defs>
          <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={faceColors[0]} />
            <stop offset="1" stopColor={faceColors[1]} />
          </linearGradient>
          <linearGradient id={`${id}-ring`} x1="0" y1="0" x2="1" y2="1">
            {ring.map((c, i) => (
              <stop key={i} offset={`${(i / (ring.length - 1)) * 100}%`} stopColor={c} />
            ))}
          </linearGradient>
          <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <path d={facePath} />
          </clipPath>
        </defs>

        {/* Tier frame */}
        <path d={path} fill={`url(#${id}-ring)`} stroke="rgba(255,255,255,0.25)" strokeWidth="0.75" />
        {/* Face */}
        <path d={facePath} fill={`url(#${id}-face)`} />
        <path d={facePath} fill={`url(#${id}-sheen)`} />
        {spec.effect === "metallic" && (
          <rect x="0" y="0" width="100" height="100" clipPath={`url(#${id}-clip)`}
            fill={`url(#${id}-ring)`} opacity="0.18" style={{ mixBlendMode: "overlay" }} />
        )}
        <path d={facePath} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="0.75" />
      </svg>

      {/* Holographic sheen (conic) clipped to the face */}
      {spec.effect === "holographic" && (
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0,
            clipPath: `url(#${id}-clip)`,
            background:
              "conic-gradient(from 0deg, #FF8FD0, #8FE8FF, #B8F36B, #F6D873, #A98BE8, #FF8FD0)",
            mixBlendMode: "plus-lighter",
            opacity: 0.3,
          }}
        />
      )}

      {/* Glyph */}
      <div
        style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Glyph size={size * 0.34} color={ink} strokeWidth={2.4} absoluteStrokeWidth />
      </div>
    </div>
  );

  if (earned) return body;

  // Locked — desaturated + progress ring.
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <div
        style={{
          position: "absolute", inset: size * 0.09,
          filter: "grayscale(1)", opacity: 0.34,
        }}
      >
        <BadgeMedallion spec={spec} size={size * 0.82} earned />
      </div>
      <svg viewBox="0 0 100 100" width={size} height={size}
        style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="4" />
        <circle
          cx="50" cy="50" r="46" fill="none"
          stroke="#5BE4C3" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${Math.max(0.001, progress) * 289} 289`}
        />
      </svg>
    </div>
  );
}

// ── Shape paths (mirror the iOS BadgeMedallion shapes) ───────────────

function shapePath(shape: BadgeShape, scale = 1): string {
  const cx = 50, cy = 50, base = 48 * scale;
  switch (shape) {
    case "coin":
      return circlePath(cx, cy, base);
    case "hexagon":
      return polygonPath(cx, cy, base, 6, Math.PI / 6 - Math.PI / 2);
    case "shield":
      return shieldPath(scale);
    case "rosette":
      return scallopPath(cx, cy, base, 14, 0.07);
    case "seal":
      return scallopPath(cx, cy, base, 22, 0.05);
  }
}

function circlePath(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`;
}

function polygonPath(cx: number, cy: number, r: number, sides: number, offset: number): string {
  let d = "";
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * 2 * Math.PI + offset;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    d += (i === 0 ? "M" : "L") + ` ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d + "Z";
}

function scallopPath(cx: number, cy: number, base: number, scallops: number, depth: number): string {
  const steps = 240;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    const r = base * (1 - depth) + base * depth * (1 + Math.sin(a * scallops)) / 2;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    d += (i === 0 ? "M" : "L") + ` ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d + "Z";
}

function shieldPath(scale: number): string {
  // 100-box shield, centre-scaled toward the middle for the inset face.
  const inset = (1 - scale) * 50;
  const x = inset, y = inset, w = 100 - inset * 2, h = 100 - inset * 2;
  return [
    `M ${x + w * 0.06} ${y + h * 0.10}`,
    `Q ${x + w * 0.28} ${y} ${x + w * 0.5} ${y + h * 0.04}`,
    `Q ${x + w * 0.72} ${y} ${x + w * 0.94} ${y + h * 0.10}`,
    `L ${x + w * 0.94} ${y + h * 0.55}`,
    `Q ${x + w * 0.86} ${y + h * 0.84} ${x + w * 0.5} ${y + h * 0.98}`,
    `Q ${x + w * 0.14} ${y + h * 0.84} ${x + w * 0.06} ${y + h * 0.55}`,
    "Z",
  ].join(" ");
}

function tint(hex?: string | null): [string, string] | null {
  if (!hex) return null;
  const clean = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  // Darken the second stop ~38% for a gradient.
  const n = parseInt(clean, 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  const dark = (v: number) => Math.round(v * 0.62).toString(16).padStart(2, "0");
  return [`#${clean}`, `#${dark(r)}${dark(g)}${dark(b)}`];
}
