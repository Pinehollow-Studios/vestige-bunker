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
 * 16:9 photo cropper for the dashboard's cover-upload flow.
 * Direct sibling to the iOS `ListCoverCropView` — same viewport
 * aspect, same hard-clamped pan, same 1×–4× zoom range, same
 * 1600×900 opaque JPEG output. Lives in the same shape so the
 * cover bytes that hit Storage from either client look the
 * same on the iOS app.
 *
 * Inputs:
 *   • Mouse wheel → zoom (1×–4×, clamped). Pinch on touchpads
 *     fires wheel events with `ctrlKey === true` — handled the
 *     same as wheel.
 *   • Mouse / touch drag → pan. Hard-clamped per `cropClamp.ts`
 *     so the image always covers the viewport.
 *   • +/- buttons → discrete zoom for keyboard / accessibility.
 *
 * Output: an off-screen canvas renders the visible viewport
 * region into a 1600×900 opaque JPEG. The source rect is
 * computed from the live (offset, scale) state in image-natural
 * coordinates so the bytes are exactly what the user is staring
 * at. Same rendering contract as the iOS `ImageRenderer`
 * pipeline.
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

  // ----- Load the picked file into an HTMLImageElement --------
  //
  // The parent (`CoverEditor`) mounts a fresh dialog instance on
  // every file pick (via the `pickedFile` state going from null
  // → File → null), so this effect only ever runs with a
  // non-null `file`. State resets happen at mount time via the
  // `useState` initialisers above — no setState-in-effect on
  // prop change, which keeps the React 19 lint happy.

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setImage(img);
    img.onerror = () => onClose();
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, onClose]);

  // ----- Resize observer for the viewport --------------------

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

  // ----- Image transform values for live render --------------

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

  // ----- Gesture handlers ------------------------------------

  function applyZoom(nextScale: number, anchor?: { x: number; y: number }) {
    const clampedScale = Math.min(Math.max(nextScale, 1), 4);
    if (clampedScale === scale) return;
    // When zooming, also re-clamp the existing offset against the
    // new bounds so a previously-valid pan doesn't leave the
    // image's edge inside the viewport. Mirrors the iOS magnify
    // gesture's `re-clamp on change` behaviour.
    const reclamped = clampOffset(offset, imageSize, viewport, clampedScale);
    setScale(clampedScale);
    setOffset(reclamped);
    void anchor; // anchor-aware zoom is a v2 polish; v1 zooms about centre.
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    // Trackpad pinch comes through wheel events with ctrlKey set.
    // Wheel scroll comes without. Both increment scale; trackpad
    // pinch fires more frequently so we damp it.
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

  // ----- Render the cropped JPEG -----------------------------

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

  // ----- Render ----------------------------------------------

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
            <h2 className="font-heading text-base">Crop cover image</h2>
            <p className="text-xs text-muted-foreground">
              16:9 — drag to reframe, pinch / scroll to zoom. Output
              is 1600×900 JPEG, same shape as the iOS app&apos;s crop
              tool.
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
            // Plain <img> with CSS transforms — the cropper preview
            // is purely visual, the final render goes through a
            // canvas (see `renderCrop`). Setting `draggable={false}`
            // because the browser's native image-drag would race
            // our pointer events.
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
            <Button
              size="sm"
              variant="outline"
              disabled={working}
              onClick={onClose}
            >
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

// ---------------------------------------------------------
// Canvas render
// ---------------------------------------------------------

const RENDER_WIDTH = 1600;
const RENDER_HEIGHT = 900;

/**
 * Render the visible viewport region into a 1600×900 opaque
 * JPEG blob. The source rect is computed in image-natural
 * coordinates from the live (offset, scale) state — exactly
 * what the user is staring at in the preview becomes the bytes
 * we upload.
 */
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

  // Image's top-left in viewport coords:
  //   imgX = vw/2 + offsetX - (imgW * totalScale) / 2
  //   imgY = vh/2 + offsetY - (imgH * totalScale) / 2
  // Reverse: viewport (0,0) maps to image (sx, sy) =
  //   ((0 - imgX) / totalScale, (0 - imgY) / totalScale)
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

  // Opaque fill so the JPEG encoder doesn't carry an alpha
  // channel — mirrors the iOS-side `UIGraphicsImageRendererFormat
  // .opaque = true` re-encode path. Black so any rounding gap at
  // the edges (shouldn't happen with the clamp, but defence in
  // depth) reads as a deliberate frame rather than a glitch.
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, RENDER_WIDTH, RENDER_HEIGHT);
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, RENDER_WIDTH, RENDER_HEIGHT);

  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
  });
}
