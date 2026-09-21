"use client";

import { useTransition } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { deleteItem } from "@/lib/actions/items";
import { dateShort, monthLabel } from "@/lib/format";
import { formatLabel, platformLabel } from "@/lib/platforms";

export interface PublishedItem {
  id: number;
  url: string;
  platform: string;
  format: string | null;
  title: string | null;
  monthRef: string;
  publishedAt: string | null;
  deliverableTitle: string | null;
}

/** Tudo o que foi publicado, agrupado por mês — o histórico com prova. */
export function PublishedList({ items }: { items: PublishedItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-[13.5px] text-ink-muted">
        Nenhum link registrado ainda. Use &ldquo;Colar links&rdquo; para trazer o
        histórico de uma vez.
      </p>
    );
  }

  const byMonth = new Map<string, PublishedItem[]>();
  for (const it of items) {
    const arr = byMonth.get(it.monthRef) ?? [];
    arr.push(it);
    byMonth.set(it.monthRef, arr);
  }
  const months = [...byMonth.keys()].sort().reverse();

  return (
    <div className="flex flex-col gap-6">
      {months.map((m) => {
        const list = byMonth.get(m)!;
        const counts = list.reduce<Record<string, number>>((acc, i) => {
          acc[i.platform] = (acc[i.platform] ?? 0) + 1;
          return acc;
        }, {});
        return (
          <section key={m}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="font-display text-[14px] font-semibold">{monthLabel(m)}</h3>
              <p className="text-[12px] text-ink-muted">
                {list.length} {list.length === 1 ? "publicação" : "publicações"}:{" "}
                {Object.entries(counts)
                  .map(([p, n]) => `${n} ${platformLabel(p)}`)
                  .join(", ")}
              </p>
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border bg-paper">
              {list.map((it) => (
                <Row key={it.id} item={it} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Row({ item }: { item: PublishedItem }) {
  const [isPending, startTransition] = useTransition();
  const fmt = formatLabel(item.format);
  return (
    <li className="group flex items-center gap-3 px-3.5 py-2.5">
      <span className="w-[4.5rem] shrink-0 text-[12px] font-medium text-ink">
        {platformLabel(item.platform)}
      </span>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-1.5 text-[12.5px] text-ink-muted hover:text-coral"
      >
        <span className="truncate">{item.title ?? item.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
        <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
      </a>
      {fmt && <span className="hidden shrink-0 text-[11.5px] text-ink-faint sm:inline">{fmt}</span>}
      {item.publishedAt && (
        <span className="shrink-0 text-[11.5px] tabular-nums text-ink-faint">
          {dateShort(item.publishedAt)}
        </span>
      )}
      <button
        disabled={isPending}
        onClick={() => {
          if (confirm("Remover este link?")) startTransition(() => deleteItem(item.id));
        }}
        aria-label="Remover link"
        className="shrink-0 rounded p-1 text-ink-faint opacity-0 transition-opacity hover:text-coral group-hover:opacity-100 focus-visible:opacity-100 cursor-pointer"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
