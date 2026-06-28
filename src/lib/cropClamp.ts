/**
 * Drag-bound math shared by every photo cropper. Direct port of
 * the iOS-side `Vestige/DesignSystem/CropClamp.swift` - same
 * formulas, same hard-clamp semantics, so the cropping UX is
 * identical across the two clients.
 *
 * The contract: at any zoom level, the image must fully cover
 * the viewport - no part of the page background ever leaks
 * through, regardless of how the user drags. Mirrors what the
 * iOS-side `CropClamp.swift` enforces and what iOS Photos /
 * Instagram crop UIs feel like.
 */

type Size = { width: number; height: number };

/**
 * Returns the maximum permitted absolute offset from centre, per
 * axis, for an image of `imageSize` displayed inside `viewport`
 * at the given `scale`. Always >= 0; both axes get clamped to
 * `+/- max` independently.
 */
export function maxOffset(
  imageSize: Size,
  viewport: Size,
  scale: number,
): Size {
  if (
    imageSize.width <= 0 ||
    imageSize.height <= 0 ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    return { width: 0, height: 0 };
  }
  // `scaledToFill` math: image's smaller-relative axis matches
  // the viewport, the larger-relative axis extends beyond.
  const imageAspect = imageSize.width / imageSize.height;
  const viewportAspect = viewport.width / viewport.height;
  let filledWidth: number;
  let filledHeight: number;
  if (imageAspect > viewportAspect) {
    filledHeight = viewport.height;
    filledWidth = viewport.height * imageAspect;
  } else {
    filledWidth = viewport.width;
    filledHeight = viewport.width / imageAspect;
  }
  const scaledWidth = filledWidth * scale;
  const scaledHeight = filledHeight * scale;
  return {
    width: Math.max(0, (scaledWidth - viewport.width) / 2),
    height: Math.max(0, (scaledHeight - viewport.height) / 2),
  };
}

/**
 * Hard-clamp `proposed` to the viewport bounds for the given
 * image + scale combo. Use from drag handlers (continuous clamp
 * during pan) and from zoom handlers (re-clamp the existing
 * offset against the new bounds when the user zooms back out).
 */
export function clampOffset(
  proposed: { x: number; y: number },
  imageSize: Size,
  viewport: Size,
  scale: number,
): { x: number; y: number } {
  const bound = maxOffset(imageSize, viewport, scale);
  return {
    x: Math.min(Math.max(proposed.x, -bound.width), bound.width),
    y: Math.min(Math.max(proposed.y, -bound.height), bound.height),
  };
}

/**
 * The `scaledToFill` factor that maps the image's smaller axis
 * onto the viewport. Used by the canvas renderer to compute the
 * final crop's source rect in image-natural-coord space.
 */
export function fillScale(imageSize: Size, viewport: Size): number {
  if (imageSize.width <= 0 || imageSize.height <= 0) return 1;
  const xRatio = viewport.width / imageSize.width;
  const yRatio = viewport.height / imageSize.height;
  return Math.max(xRatio, yRatio);
}
