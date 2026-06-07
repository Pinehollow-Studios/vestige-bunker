import { Map as MapIcon } from "lucide-react";
import type { GeoJSONPolygonOrMulti } from "../types";

/**
 * Read-only polygon preview. Renders the course boundary via the
 * Mapbox Static Images API when `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`
 * is configured; otherwise renders a small badge with vertex count
 * so admins can confirm the polygon is present even without a
 * Mapbox account on the dashboard side.
 *
 * Polygon editing in the dashboard is deferred per the cross-stack
 * courses build plan (decision §4): polygon writes stay in the
 * import script + Supabase Studio in v1.
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
      <div className="flex h-32 w-full items-center justify-center rounded-lg border border-rule/70 bg-paper-sunken/40 text-xs text-ink-3">
        No polygon — pin only.
      </div>
    );
  }

  const url = staticImageURL(polygon, centerLat, centerLng);
  if (!url) {
    return (
      <div className="flex h-32 w-full flex-col items-center justify-center gap-1 rounded-lg border border-rule/70 bg-paper-sunken/40 text-xs text-ink-2">
        <MapIcon aria-hidden className="size-5 text-ink-3" />
        <span>Polygon present</span>
        <span className="text-[10px] text-ink-3">
          Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to render the preview.
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Course polygon preview"
      className="h-32 w-full rounded-lg border border-rule/70 object-cover"
    />
  );
}

function staticImageURL(
  polygon: GeoJSONPolygonOrMulti,
  centerLat: number | null,
  centerLng: number | null,
): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return null;

  // Encode the polygon as a GeoJSON overlay. The static API caps
  // URL length at ~8 KB; complex multi-polygons can blow past
  // that. Serialise compactly and fall back to nothing if too big.
  const payload = {
    type: "Feature",
    geometry: polygon,
    properties: {
      stroke: "#1F4D4A",
      "stroke-width": 2,
      fill: "#1F4D4A",
      "fill-opacity": 0.25,
    },
  };
  const overlay = `geojson(${encodeURIComponent(JSON.stringify(payload))})`;

  const lat = centerLat ?? 53.5;
  const lng = centerLng ?? -1.5;
  const baseURL = `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${overlay}/${lng.toFixed(5)},${lat.toFixed(5)},14,0/300x150@2x`;
  const fullURL = `${baseURL}?access_token=${token}`;

  if (fullURL.length > 8000) return null;
  return fullURL;
}
