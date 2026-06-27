import { MapPin, Hexagon } from "lucide-react";
import type { GeoJSONPolygonOrMulti } from "../types";

/**
 * Read-only render of the course boundary Jack mapped by hand. Draws the
 * polygon over Mapbox satellite imagery via the Static Images API, auto-fit
 * to the polygon's bounds (no fixed centre/zoom — it always frames the shape),
 * when `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is configured. Falls back to a vertex
 * count so admins can still confirm the polygon is present.
 *
 * Polygon editing in the dashboard is deferred per the cross-stack courses
 * build plan (decision §4): polygon writes stay in the import script +
 * Supabase Studio in v1.
 */
export function PolygonPreview({
  polygon,
  centerLat,
  centerLng,
}: {
  polygon: GeoJSONPolygonOrMulti | null;
  centerLat: number | null;
  centerLng: number | null;
}) {
  if (!polygon) {
    return (
      <Shell>
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-ink-3">
          <MapPin aria-hidden className="size-6 text-ink-3/70" />
          <span className="text-xs">No polygon mapped — pin only.</span>
        </div>
      </Shell>
    );
  }

  const points = countVertices(polygon);
  const url = staticImageURL(polygon, centerLat, centerLng);

  if (!url) {
    return (
      <Shell>
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-ink-2">
          <Hexagon aria-hidden className="size-6 text-brand" />
          <span className="text-xs font-medium">Polygon mapped · {points} points</span>
          <span className="text-[10px] text-ink-3">
            Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to render the boundary.
          </span>
        </div>
      </Shell>
    );
  }

  return (
    <figure className="space-y-1.5">
      <div className="relative overflow-hidden rounded-xl border border-rule/70 ring-1 ring-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Course boundary on satellite imagery"
          className="aspect-[5/3] w-full object-cover"
        />
        <figcaption className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium text-ink backdrop-blur-sm">
          <Hexagon aria-hidden className="size-3 text-brand" />
          Boundary · {points} points
        </figcaption>
      </div>
    </figure>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="aspect-[5/3] w-full overflow-hidden rounded-xl border border-rule/70 bg-paper-sunken/40">
      {children}
    </div>
  );
}

function staticImageURL(
  polygon: GeoJSONPolygonOrMulti,
  centerLat: number | null,
  centerLng: number | null,
): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return null;

  // Round coordinates to ~5 decimals (≈1m) so the GeoJSON serialises compactly
  // — the static API caps URL length at ~8 KB and hand-mapped boundaries can
  // carry many vertices.
  const geometry = roundGeometry(polygon);
  const payload = {
    type: "Feature",
    geometry,
    properties: {
      stroke: "#5BE4C3",
      "stroke-width": 3,
      "stroke-opacity": 1,
      fill: "#5BE4C3",
      "fill-opacity": 0.18,
    },
  };
  const overlay = `geojson(${encodeURIComponent(JSON.stringify(payload))})`;

  // `auto` fits the viewport to the overlay bounds with sensible padding —
  // no reliance on centre_lat/lng or a guessed zoom level. Satellite-streets
  // gives the boundary real course context (greens, fairways, treelines).
  const base = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${overlay}/auto/600x360@2x`;
  let fullURL = `${base}?access_token=${token}&padding=24`;

  // Last-ditch fallback for an enormous polygon: drop to a centred pin view
  // rather than failing the request outright.
  if (fullURL.length > 8000) {
    const lat = centerLat ?? 53.5;
    const lng = centerLng ?? -1.5;
    fullURL = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/pin-s+5BE4C3(${lng.toFixed(5)},${lat.toFixed(5)})/${lng.toFixed(5)},${lat.toFixed(5)},14,0/600x360@2x?access_token=${token}`;
  }
  return fullURL;
}

/** Round every coordinate pair to 5 decimal places, preserving nesting depth. */
function roundGeometry(polygon: GeoJSONPolygonOrMulti): GeoJSONPolygonOrMulti {
  const round = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(round)
      : typeof v === "number"
        ? Math.round(v * 1e5) / 1e5
        : v;
  return { type: polygon.type, coordinates: round(polygon.coordinates) };
}

/** Count coordinate pairs anywhere in the (possibly multi-) polygon. */
function countVertices(polygon: GeoJSONPolygonOrMulti): number {
  let n = 0;
  const walk = (v: unknown): void => {
    if (
      Array.isArray(v) &&
      v.length >= 2 &&
      typeof v[0] === "number" &&
      typeof v[1] === "number"
    ) {
      n += 1;
    } else if (Array.isArray(v)) {
      for (const child of v) walk(child);
    }
  };
  walk(polygon.coordinates);
  return n;
}
