import { Signal, Smartphone, Wifi } from "lucide-react";

/**
 * A phone frame for the live in-app preview that sits beside an editor. The
 * dashboard already uses the iOS Atlas palette (paper / ink / mint), so content
 * rendered inside reads app-accurate. Turns "data entry" into "authoring" —
 * you see what users will see as you type.
 */
export function PreviewFrame({
  children,
  label = "Live preview",
  caption = "How it looks in the app",
}: {
  children: React.ReactNode;
  label?: string;
  caption?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
        <Smartphone aria-hidden className="size-3.5" />
        {label}
      </p>
      <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[2.6rem] border-[8px] border-[#05090d] bg-paper shadow-2xl ring-1 ring-white/10">
        {/* Status bar with a Dynamic Island */}
        <div className="relative flex items-center justify-between bg-paper px-6 pb-1.5 pt-2.5 text-[10px] font-semibold text-ink">
          <span className="tabular-nums">9:41</span>
          <span
            aria-hidden
            className="absolute left-1/2 top-2 h-[18px] w-[72px] -translate-x-1/2 rounded-full bg-[#05090d]"
          />
          <span aria-hidden className="flex items-center gap-1 text-ink-2">
            <Signal className="size-3" />
            <Wifi className="size-3" />
            <span className="ml-0.5 h-2.5 w-4 rounded-[3px] border border-ink-2/70 p-[1.5px]">
              <span className="block h-full w-2/3 rounded-[1px] bg-ink-2/80" />
            </span>
          </span>
        </div>
        <div className="max-h-[68vh] overflow-y-auto overscroll-contain">{children}</div>
        {/* Home indicator */}
        <div className="flex justify-center bg-paper pb-1.5 pt-1">
          <span aria-hidden className="h-1 w-28 rounded-full bg-ink-2/30" />
        </div>
      </div>
      <p className="text-center text-[10px] text-ink-3/70">{caption}</p>
    </div>
  );
}
