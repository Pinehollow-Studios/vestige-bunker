"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Re-fetch the health board (the page is force-dynamic, so a refresh re-runs
 *  the RPCs). */
export function HealthRefresh() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" size="sm" onClick={() => start(() => router.refresh())} disabled={pending}>
      <RotateCw className={pending ? "size-4 animate-spin" : "size-4"} />
      {pending ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
