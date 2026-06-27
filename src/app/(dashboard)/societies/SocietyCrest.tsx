import {
  Calendar,
  Crown,
  Flag,
  Flame,
  Globe,
  Goal,
  Leaf,
  type LucideIcon,
  Map as MapIcon,
  MapPin,
  Medal,
  Mountain,
  Shield,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import type { CSSProperties } from "react";
import { crestColorHex } from "./types";

/**
 * Crest glyph options — the `token` is the iOS SF Symbol name stored in the
 * `crest` jsonb (so the phone renders the real glyph); the `icon` is the
 * closest lucide equivalent for the admin preview, and `label` is the picker
 * caption. Keep this list in lockstep with `SocietyCrestView.glyphChoices` on
 * iOS.
 */
export const CREST_GLYPHS: { token: string; label: string; icon: LucideIcon }[] = [
  { token: "flag.fill", label: "Flag", icon: Flag },
  { token: "figure.golf", label: "Golfer", icon: Goal },
  { token: "bolt.fill", label: "Bolt", icon: Zap },
  { token: "person.3.fill", label: "Group", icon: Users },
  { token: "trophy.fill", label: "Trophy", icon: Trophy },
  { token: "medal.fill", label: "Medal", icon: Medal },
  { token: "crown.fill", label: "Crown", icon: Crown },
  { token: "target", label: "Target", icon: Target },
  { token: "flame.fill", label: "Flame", icon: Flame },
  { token: "star.fill", label: "Star", icon: Star },
  { token: "sparkles", label: "Sparkles", icon: Sparkles },
  { token: "shield.fill", label: "Shield", icon: Shield },
  { token: "mappin.and.ellipse", label: "Pin", icon: MapPin },
  { token: "map.fill", label: "Map", icon: MapIcon },
  { token: "globe.europe.africa.fill", label: "Globe", icon: Globe },
  { token: "calendar", label: "Calendar", icon: Calendar },
  { token: "leaf.fill", label: "Leaf", icon: Leaf },
  { token: "mountain.2.fill", label: "Mountain", icon: Mountain },
];

const GLYPH_BY_TOKEN: Record<string, LucideIcon> = Object.fromEntries(
  CREST_GLYPHS.map((g) => [g.token, g.icon]),
);

/** Renders one crest glyph from its token, falling back to the flag. */
function GlyphMark({ glyph, style }: { glyph: string | null | undefined; style: CSSProperties }) {
  const Icon = (glyph && GLYPH_BY_TOKEN[glyph]) || Flag;
  return <Icon style={style} strokeWidth={2.2} />;
}

/** A native-composed society crest preview — glyph on an Atlas-colour tile. */
export function SocietyCrest({
  glyph,
  color,
  size = 48,
}: {
  glyph: string | null | undefined;
  color: string | null | undefined;
  size?: number;
}) {
  const hex = crestColorHex(color);
  const px = size * 0.44;
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-xl"
      style={{
        width: size,
        height: size,
        backgroundColor: `${hex}2E`, // ~18% alpha tile
        boxShadow: `inset 0 0 0 1px ${hex}73`, // ~45% alpha hairline
      }}
    >
      <GlyphMark glyph={glyph} style={{ width: px, height: px, color: hex }} />
    </span>
  );
}
