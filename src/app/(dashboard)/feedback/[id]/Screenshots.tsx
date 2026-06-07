"use client";

import Image from "next/image";
import { useState } from "react";
import { Camera, X } from "lucide-react";
import type { FeedbackScreenshot } from "@/lib/feedback/types";

type Props = {
  screenshots: FeedbackScreenshot[];
  signedURLs: Array<string | null>;
};

/**
 * Grid + lightbox for the redacted screenshots attached to a
 * feedback report. The host page mints signed URLs (60-min TTL)
 * server-side and passes them down — `null` slots render the
 * "couldn't load" placeholder.
 */
export function Screenshots({ screenshots, signedURLs }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (screenshots.length === 0) return null;

  return (
    <article className="space-y-3 rounded-xl border border-rule/70 bg-paper-raised/50 p-5">
      <header className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">
          Screenshots ({screenshots.length})
        </p>
        <p className="text-[11px] text-ink-3">
          Tap to expand · signed URLs (60 min)
        </p>
      </header>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {screenshots.map((shot, index) => {
          const url = signedURLs[index];
          return (
            <li key={shot.id}>
              <button
                type="button"
                onClick={() => url && setOpenIndex(index)}
                disabled={!url}
                className="group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-rule/60 bg-paper-sunken/60 disabled:cursor-not-allowed"
              >
                {url ? (
                  // Plain <img> matches the rest of the dashboard's signed-URL paths.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={`Screenshot ${index + 1}`}
                    className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
                  />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-[10px] text-ink-3">
                    <Camera aria-hidden className="size-4" />
                    Failed to sign
                  </span>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 text-[10px] text-paper-raised/90">
                  <span>{shot.auto_captured ? "Auto" : "Attached"}</span>
                  {shot.redacted && (
                    <span className="rounded-full bg-paper-raised/85 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-ink">
                      Redacted
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {openIndex !== null && signedURLs[openIndex] && (
        <Lightbox
          url={signedURLs[openIndex]!}
          onClose={() => setOpenIndex(null)}
        />
      )}
      {/* `next/image` import retained for a future variant viewer that
          can use the optimised pipeline once the bucket goes through
          a known-domain config. */}
      {void Image}
    </article>
  );
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-paper-raised/85 p-2 text-ink shadow-md"
        aria-label="Close screenshot viewer"
      >
        <X className="size-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Expanded screenshot"
        className="max-h-full max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
