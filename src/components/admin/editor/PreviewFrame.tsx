import { Smartphone } from "lucide-react";

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
      <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[2.2rem] border-[7px] border-[#05090d] bg-paper shadow-2xl ring-1 ring-white/5">
        <div className="flex items-center justify-between bg-paper px-6 pb-1 pt-2 text-[9px] font-medium text-ink-3">
          <span>9:41</span>
          <span aria-hidden className="flex items-center gap-1">
            <span className="h-2 w-3.5 rounded-[2px] border border-ink-3/60" />
          </span>
        </div>
        <div className="max-h-[68vh] overflow-y-auto overscroll-contain">{children}</div>
      </div>
      <p className="text-center text-[10px] text-ink-3/70">{caption}</p>
    </div>
  );
}
