import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  title: string;
  description: string;
  count?: number;
  status: "live" | "soon";
};

export function QueueTile({ href, title, description, count, status }: Props) {
  const showAttention = status === "live" && (count ?? 0) > 0;
  const body = (
    <Card
      className={cn(
        "h-full transition-all",
        status === "live" &&
          "hover:border-brand/40",
        showAttention && "border-brand/30 ring-brand/15",
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {status === "soon" ? (
            <Badge variant="outline">Soon</Badge>
          ) : (
            count !== undefined && (
              <Badge
                variant={count > 0 ? "default" : "outline"}
                className={cn(count > 0 && "bg-brand text-brand-fg")}
              >
                {count}
              </Badge>
            )
          )}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {status === "live" ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand">
            Open queue
            <ArrowUpRight aria-hidden className="size-3.5" />
          </span>
        ) : (
          <span className="text-xs text-ink-3">
            Wires up when the iOS feature lands.
          </span>
        )}
      </CardContent>
    </Card>
  );

  if (status === "soon") return body;
  return <Link href={href}>{body}</Link>;
}
