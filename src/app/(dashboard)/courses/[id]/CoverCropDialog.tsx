"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { clampOffset, fillScale } from "@/lib/cropClamp";

type Props = {
  /** File the user picked from disk; the dialog opens when this is non-null. */
  file: File | null;
  /** Called when the user cancels or after a successful confirm. */
  onClose: () => void;
  /** Called with the cropped JPEG blob (1600×900, opaque, q=0.85). */
  onConfirm: (blob: Blob) => void;
};

/**
 * 16:9 photo cropper for the course-cover upload flow. Forked from
 * the curated-cover crop dialog so the two surfaces can drift
 * independently if their shapes ever diverge — same code today,
 * but the courses cover lives next to course-only state and the
 * curated cover lives next to curated-only state, so duplication
 * is preferable to a shared component that grows props.
 *
 * Inputs:
 *   • Mouse wheel → zoom (1×–4×, clamped). Pinch on touchpads
 *     fires wheel events with `ctrlKey === true` — handled the
 *     same as wheel.
 *   • Mouse / touch drag → pan. Hard-clamped per `cropClamp.ts`
 *     so the image always covers the viewport.
 *   • +/- buttons → discrete zoom for keyboard / accessibility.
 *
 * Output: an off-screen canvas renders the visible viewport region
 * into a 1600×900 opaque JPEG. Same rendering contract as the iOS
 * `ImageRenderer` pipeline.
 */
export function CoverCropDialog({ file, onClose, onConfirm }: Props) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    anchorX: number;
    anchorY: number;
  } | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setImage(img);
    img.onerror = () => onClose();
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, onClose]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setViewport({ width: rect.width, height: rect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [image]);

  const imageSize = useMemo(
    () =>
      image
        ? { width: image.naturalWidth, height: image.naturalHeight }
        : { width: 0, height: 0 },
    [image],
  );

  const baseFill = useMemo(() => fillScale(imageSize, viewport), [imageSize, viewport]);

  const totalScale = baseFill * scale;
  const transformedWidth = imageSize.width * totalScale;
  const transformedHeight = imageSize.height * totalScale;

  function applyZoom(nextScale: number) {
    const clampedScale = Math.min(Math.max(nextScale, 1), 4);
    if (clampedScale === scale) return;
    const reclamped = clampOffset(offset, imageSize, viewport, clampedScale);
    setScale(clampedScale);
    setOffset(reclamped);
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const factor = e.ctrlKey ? 0.01 : 0.0025;
    const delta = -e.deltaY * factor;
    applyZoom(scale + delta);
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      anchorX: offset.x,
      anchorY: offset.y,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const proposed = {
      x: dragRef.current.anchorX + dx,
      y: dragRef.current.anchorY + dy,
    };
    setOffset(clampOffset(proposed, imageSize, viewport, scale));
  }

  function onPointerUp(e: React.PointerEvent) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
  }

  async function confirm() {
    if (!image || working) return;
    if (viewport.width === 0 || viewport.height === 0) return;
    setWorking(true);
    try {
      const blob = await renderCrop({
        image,
        viewport,
        scale,
        offset,
        baseFill,
      });
      if (!blob) throw new Error("renderCrop returned no blob");
      onConfirm(blob);
    } finally {
      setWorking(false);
    }
  }

  if (!file) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget && !working) onClose();
      }}
    >
      <div className="w-full max-w-3xl space-y-4 rounded-xl border border-rule/70 bg-paper-raised p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-base">Crop hero photo</h2>
            <p className="text-xs text-muted-foreground">
              16:9 — drag to reframe, pinch / scroll to zoom. Output
              is 1600×900 JPEG.
            </p>
          </div>
        </div>

        <div
          ref={viewportRef}
          className="relative w-full overflow-hidden rounded-lg ring-2 ring-primary"
          style={{ aspectRatio: "16 / 9", touchAction: "none", cursor: "grab" }}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {!image ? (
            <div className="flex h-full w-full items-center justify-center bg-muted text-xs uppercase tracking-wider text-muted-foreground">
              Loading…
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute select-none"
              style={{
                width: `${transformedWidth}px`,
                height: `${transformedHeight}px`,
                left: `${(viewport.width - transformedWidth) / 2 + offset.x}px`,
                top: `${(viewport.height - transformedHeight) / 2 + offset.y}px`,
                maxWidth: "none",
              }}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={working}
              onClick={() => applyZoom(scale - 0.25)}
              aria-label="Zoom out"
            >
              −
            </Button>
            <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
              {scale.toFixed(2)}×
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={working}
              onClick={() => applyZoom(scale + 0.25)}
              aria-label="Zoom in"
            >
              +
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={working}
              onClick={() => {
                setScale(1);
                setOffset({ x: 0, y: 0 });
              }}
            >
              Reset
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={working} onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" disabled={working || !image} onClick={confirm}>
              {working ? "Saving…" : "Use photo"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const RENDER_WIDTH = 1600;
const RENDER_HEIGHT = 900;

async function renderCrop(args: {
  image: HTMLImageElement;
  viewport: { width: number; height: number };
  scale: number;
  offset: { x: number; y: number };
  baseFill: number;
}): Promise<Blob | null> {
  const { image, viewport, scale, offset, baseFill } = args;
  const totalScale = baseFill * scale;
  if (totalScale <= 0) return null;

  const imgX =
    viewport.width / 2 + offset.x - (image.naturalWidth * totalScale) / 2;
  const imgY =
    viewport.height / 2 + offset.y - (image.naturalHeight * totalScale) / 2;

  const sx = -imgX / totalScale;
  const sy = -imgY / totalScale;
  const sw = viewport.width / totalScale;
  const sh = viewport.height / totalScale;

  const canvas = document.createElement("canvas");
  canvas.width = RENDER_WIDTH;
  canvas.height = RENDER_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, RENDER_WIDTH, RENDER_HEIGHT);
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, RENDER_WIDTH, RENDER_HEIGHT);

  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
  });
}
