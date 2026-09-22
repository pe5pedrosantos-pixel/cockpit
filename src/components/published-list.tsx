"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { deleteItem, updateItem } from "@/lib/actions/items";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { dateShort, monthLabel } from "@/lib/format";
import { FORMATS, PLATFORMS, formatLabel, platformLabel } from "@/lib/platforms";

export interface PublishedItem {
  id: number;
  url: string | null;
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
      {item.url ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 flex-1 items-center gap-1.5 text-[12.5px] text-ink-muted hover:text-coral"
        >
          <span className="truncate">
            {item.title ?? item.url.replace(/^https?:\/\/(www\.)?/, "")}
          </span>
          <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
        </a>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[12.5px] text-ink-muted">
          <span className="truncate">{item.title ?? "Publicação sem link"}</span>
          <span className="shrink-0 text-[11px] text-ink-faint">sem link</span>
        </span>
      )}
      {fmt && <span className="hidden shrink-0 text-[11.5px] text-ink-faint sm:inline">{fmt}</span>}
      {item.publishedAt && (
        <span className="shrink-0 text-[11.5px] tabular-nums text-ink-faint">
          {dateShort(item.publishedAt)}
        </span>
      )}
      <EditItemDialog item={item} />
      <button
        disabled={isPending}
        onClick={() => {
          if (confirm("Remover este link?")) startTransition(() => deleteItem(item.id));
        }}
        aria-label="Remover link"
        className="shrink-0 rounded p-1 text-ink-faint transition-opacity hover:text-coral sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 cursor-pointer"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function EditItemDialog({ item }: { item: PublishedItem }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <button
          aria-label="Editar publicação"
          className="shrink-0 cursor-pointer rounded p-1 text-ink-faint transition-opacity hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent title="Editar publicação">
        <form
          action={(fd) => {
            setError(null);
            startTransition(async () => {
              const res = await updateItem(item.id, fd);
              if (res.ok) setOpen(false);
              else setError(res.message);
            });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`it-title-${item.id}`}>Nome</Label>
            <Input id={`it-title-${item.id}`} name="title" defaultValue={item.title ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`it-url-${item.id}`}>Link (opcional)</Label>
            <Input id={`it-url-${item.id}`} name="url" type="url" defaultValue={item.url ?? ""} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`it-platform-${item.id}`}>Rede</Label>
              <Select id={`it-platform-${item.id}`} name="platform" defaultValue={item.platform}>
                {Object.entries(PLATFORMS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`it-format-${item.id}`}>Formato</Label>
              <Select id={`it-format-${item.id}`} name="format" defaultValue={item.format ?? ""}>
                <option value="">Sem formato</option>
                {Object.entries(FORMATS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`it-date-${item.id}`}>Data</Label>
              <Input
                id={`it-date-${item.id}`}
                name="publishedAt"
                type="date"
                defaultValue={item.publishedAt?.slice(0, 10) ?? ""}
              />
            </div>
          </div>
          {error && <p className={cn("text-[13px] text-coral")}>{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
