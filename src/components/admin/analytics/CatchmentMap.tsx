import type { CountyShape, GeoPolygon } from "@/lib/analytics/queries";

/**
 * Dependency-free England catchment choropleth. Server-renders the county
 * GeoJSON into SVG paths (equirectangular projection, latitude-corrected) and
 * shades each county by its threshold-cleared player count from b2b_catchment.
 * Counties below the cohort threshold (absent from `values`) render neutral —
 * so the map shows exactly what a club would be allowed to see.
 */

type Pt = [number, number];

function rings(p: GeoPolygon): Pt[][] {
  if (p.type === "Polygon") return p.coordinates as Pt[][];
  return (p.coordinates as number[][][][]).flat() as Pt[][];
}

const BRAND: [number, number, number] = [91, 228, 195]; // #5BE4C3

export function CatchmentMap({
  shapes,
  values,
}: {
  shapes: CountyShape[];
  values: Record<string, number>;
}) {
  if (shapes.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-rule/70 bg-paper-sunken/40 text-[12px] text-ink-3">
        County geometry unavailable.
      </div>
    );
  }

  // bounds across every ring
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const s of shapes) {
    for (const ring of rings(s.polygon)) {
      for (const [lon, lat] of ring) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }

  const W = 680;
  const midLat = (minLat + maxLat) / 2;
  const lonScale = Math.cos((midLat * Math.PI) / 180);
  const effLonSpan = Math.max((maxLon - minLon) * lonScale, 1e-6);
  const latSpan = Math.max(maxLat - minLat, 1e-6);
  const H = Math.round((W * latSpan) / effLonSpan);
  const x = (lon: number) => ((lon - minLon) * lonScale) / effLonSpan * W;
  const y = (lat: number) => ((maxLat - lat) / latSpan) * H;

  const max = Math.max(1, ...Object.values(values));
  const pathFor = (s: CountyShape) =>
    rings(s.polygon)
      .map(
        (ring) =>
          "M" +
          ring.map(([lon, lat]) => `${x(lon).toFixed(1)} ${y(lat).toFixed(1)}`).join("L") +
          "Z",
      )
      .join(" ");
  const fillFor = (id: string) => {
    const v = values[id];
    if (!v) return "rgba(255,255,255,0.035)";
    const t = 0.18 + 0.82 * (v / max);
    return `rgba(${BRAND[0]},${BRAND[1]},${BRAND[2]},${t.toFixed(3)})`;
  };

  const shaded = shapes.filter((s) => values[s.id]).length;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-rule bg-paper-sunken/40 p-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`England catchment choropleth: ${shaded} counties above the cohort threshold`}
        >
          {shapes.map((s) => (
            <path
              key={s.id}
              d={pathFor(s)}
              fill={fillFor(s.id)}
              stroke="rgba(255,255,255,0.14)"
              strokeWidth={0.6}
              fillRule="evenodd"
            >
              <title>{`${s.name}${values[s.id] ? ` — ${values[s.id]} players` : ""}`}</title>
            </path>
          ))}
        </svg>
      </div>
      <div className="flex items-center justify-between text-[11px] text-ink-3">
        <span>{shaded} counties above the threshold</span>
        <span className="flex items-center gap-2">
          <span>fewer</span>
          <span className="h-2 w-24 rounded-full" style={{ background: `linear-gradient(90deg, rgba(${BRAND[0]},${BRAND[1]},${BRAND[2]},0.18), rgba(${BRAND[0]},${BRAND[1]},${BRAND[2]},1))` }} />
          <span>more</span>
        </span>
      </div>
    </div>
  );
}
