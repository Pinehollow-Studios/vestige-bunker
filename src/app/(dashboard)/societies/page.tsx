import { SectionHeader } from "@/components/admin/SectionHeader";
import { TableToolbar, TableSelect } from "@/components/admin/table/TableToolbar";
import type { SortDir } from "@/components/admin/table/DataTable";
import { createClient } from "@/lib/supabase/server";
import { NewSocietyButton } from "./NewSocietyButton";
import { SocietyCard } from "./SocietyCard";
import type { SocietyRow } from "./types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; sort?: string; dir?: string }>;

export default async function SocietiesPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const sort = sp.sort ?? "name";
  const dir: SortDir = sp.dir === "desc" ? "desc" : "asc";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_societies");
  const all = (data as SocietyRow[] | null) ?? [];

  let rows = all;
  if (q) {
    rows = rows.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.county_name ?? "").toLowerCase().includes(q),
    );
  }
  rows = [...rows].sort((a, b) => {
    const m = dir === "asc" ? 1 : -1;
    switch (sort) {
      case "kind":
        return (Number(b.is_editorial) - Number(a.is_editorial)) * m;
      case "members":
        return (a.member_count - b.member_count) * m;
      case "created":
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * m;
      default:
        return a.name.localeCompare(b.name) * m;
    }
  });

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <SectionHeader eyebrow="Editorial" title="Societies" actions={<NewSocietyButton />} />

      <p className="max-w-2xl text-sm text-ink-2">
        Editorial societies are the preset groups suggested to players by home county (e.g. “London
        Clubs”). Create one, give it a crest, and pick the county it’s suggested to — members opt in
        from the app. Member-created societies appear here read-only for awareness.
      </p>

      <TableToolbar
        initialQuery={sp.q ?? ""}
        searchPlaceholder="Search societies…"
        countLabel={`${rows.length} of ${all.length} ${all.length === 1 ? "society" : "societies"}`}
        hasFilters={Boolean(q)}
      >
        <TableSelect
          name="sort"
          label="Sort"
          value={sort}
          options={[
            { value: "name", label: "Name" },
            { value: "kind", label: "Type" },
            { value: "members", label: "Members" },
            { value: "created", label: "Created" },
          ]}
        />
      </TableToolbar>

      {error ? (
        <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-sm text-alert">
          Failed to load: {error.message}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl glass-panel p-6 text-center text-sm text-ink-3">No societies match.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((r) => (
            <SocietyCard key={r.society_id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}
