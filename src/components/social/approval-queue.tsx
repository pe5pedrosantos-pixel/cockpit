"use client";

import { useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import { adjustPostAction, approvePostsAction } from "@/lib/actions/social";
import { WEEKDAYS_SHORT, weekdayOf } from "@/lib/social/constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { PostDialog } from "@/components/social/post-dialog";
import { MediaGallery } from "@/components/social/media-gallery";
import { BgSwatch, Empty, Feedback, LineDot, PostStatusBadge, useAction } from "@/components/social/bits";
import type { LineData, PostData } from "@/components/social/types";
import { cn } from "@/lib/utils";

/**
 * Fila de aprovação: o que espera o OK do Pedro e o que voltou para ajuste.
 * Aprovar abre o pedido de agendamento para o agente.
 */
export function ApprovalQueue({
  waiting,
  adjusting,
  lines,
  aiEnabled,
  storageEnabled,
}: {
  waiting: PostData[];
  adjusting: PostData[];
  lines: LineData[];
  aiEnabled: boolean;
  storageEnabled: boolean;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const { pending, msg, run } = useAction();
  const all = [...waiting, ...adjusting];
  const open = all.find((p) => p.id === openId) ?? null;

  if (!waiting.length && !adjusting.length) {
    return <Empty>Nada esperando o seu OK. Quando o agente terminar uma peça, ela aparece aqui.</Empty>;
  }

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="flex flex-col gap-4">
      {waiting.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-paper px-3 py-2.5">
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={selected.length === waiting.length}
              onChange={(e) => setSelected(e.target.checked ? waiting.map((p) => p.id) : [])}
            />
            Selecionar todos ({waiting.length})
          </label>
          <Button
            variant="coral"
            size="sm"
            className="ml-auto"
            disabled={pending || !selected.length}
            onClick={() => run(() => approvePostsAction(selected), (r) => r.ok && setSelected([]))}
          >
            <Check className="h-3.5 w-3.5" /> Aprovar {selected.length ? `${selected.length} selecionado${selected.length > 1 ? "s" : ""}` : "selecionados"}
          </Button>
        </div>
      )}
      <Feedback msg={msg} />

      {waiting.map((p) => (
        <QueueCard
          key={p.id}
          post={p}
          line={lines.find((l) => l.slug === p.lineSlug)}
          selected={selected.includes(p.id)}
          onToggle={() => toggle(p.id)}
          onOpen={() => setOpenId(p.id)}
        />
      ))}

      {adjusting.length > 0 && (
        <>
          <h3 className="mt-2 text-[12.5px] font-semibold text-ink-muted">Em ajuste com o agente</h3>
          {adjusting.map((p) => (
            <QueueCard key={p.id} post={p} line={lines.find((l) => l.slug === p.lineSlug)} onOpen={() => setOpenId(p.id)} />
          ))}
        </>
      )}

      {open && (
        <PostDialog
          key={open.id}
          post={open}
          date={open.date}
          suggestedBg={open.background ?? "branco"}
          neighborBgs={[]}
          lines={lines}
          aiEnabled={aiEnabled}
          storageEnabled={storageEnabled}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function QueueCard({
  post: p,
  line,
  selected,
  onToggle,
  onOpen,
}: {
  post: PostData;
  line: LineData | undefined;
  selected?: boolean;
  onToggle?: () => void;
  onOpen: () => void;
}) {
  const [tab, setTab] = useState<"linkedin" | "instagram">(p.networks.includes("linkedin") ? "linkedin" : "instagram");
  const [adjust, setAdjust] = useState<string | null>(null);
  const { pending, msg, run } = useAction();
  const caption = tab === "linkedin" ? p.captionLinkedin : p.captionInstagram;
  const time = tab === "linkedin" ? p.timeLinkedin : p.timeInstagram;
  const waiting = p.status === "aguardando_ok";

  return (
    <article
      className={cn(
        "grid gap-4 rounded-xl border bg-paper p-4 md:grid-cols-[15rem_1fr]",
        selected ? "border-coral" : "border-border"
      )}
    >
      <div className="flex flex-col gap-2">
        {p.media.length === 0 && p.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.previewUrl} alt={`Prévia: ${p.title}`} className="aspect-[4/5] w-full rounded-md border border-border object-cover" />
        ) : (
          <MediaGallery media={p.media} title={p.title} bg={p.background} size="sm" />
        )}
        {p.media.length === 0 && (
          <button type="button" onClick={onOpen} className="cursor-pointer text-left text-[11.5px] text-ink-muted underline underline-offset-2">
            Sem arte ainda · anexar
          </button>
        )}
        {p.artUrl && (
          <a href={p.artUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-medium text-navy underline underline-offset-2">
            Abrir a arte <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[12px] text-ink-muted">
              {onToggle && (
                <input type="checkbox" checked={!!selected} onChange={onToggle} aria-label={`Selecionar ${p.title}`} />
              )}
              <span className="font-semibold text-ink">
                {WEEKDAYS_SHORT[weekdayOf(p.date)]} {p.date.slice(8, 10)}/{p.date.slice(5, 7)}
              </span>
              <LineDot line={line} /> {line?.name ?? "Sem linha"}
              <BgSwatch value={p.background} />
            </p>
            <button type="button" onClick={onOpen} className="mt-1 cursor-pointer text-left font-display text-[16px] font-semibold leading-snug hover:underline">
              {p.title}
            </button>
            {p.format && <p className="text-[12px] text-ink-muted">{p.format}</p>}
          </div>
          <PostStatusBadge status={p.status} />
        </div>

        {p.pending && <p className="rounded-md bg-black/[0.035] px-2.5 py-1.5 text-[12px]">Pendência: {p.pending}</p>}
        {p.status === "ajuste" && p.adjustRequest && (
          <p className="rounded-md bg-black/[0.035] px-2.5 py-1.5 text-[12px]">Seu ajuste: {p.adjustRequest}</p>
        )}

        <div>
          <div className="flex gap-4 border-b border-border text-[12.5px]">
            {(["linkedin", "instagram"] as const)
              .filter((n) => p.networks.includes(n))
              .map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTab(n)}
                  className={cn(
                    "-mb-px cursor-pointer border-b-2 pb-1.5",
                    tab === n ? "border-coral font-semibold text-ink" : "border-transparent text-ink-muted"
                  )}
                >
                  {n === "linkedin" ? "LinkedIn" : "Instagram"}
                </button>
              ))}
            {time && <span className="ml-auto pb-1.5 text-ink-muted">às {time}</span>}
          </div>
          <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-line text-[13px] leading-relaxed text-ink">
            {caption || <span className="text-ink-faint">Sem legenda ainda.</span>}
          </p>
        </div>

        {waiting && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="coral" size="sm" disabled={pending} onClick={() => run(() => approvePostsAction([p.id]))}>
              <Check className="h-3.5 w-3.5" /> Aprovar
            </Button>
            <Button variant="outline" size="sm" disabled={pending} onClick={() => setAdjust(adjust === null ? "" : null)}>
              Pedir ajuste
            </Button>
            <Button variant="ghost" size="sm" onClick={onOpen}>
              Editar
            </Button>
          </div>
        )}
        {adjust !== null && (
          <div className="flex flex-col gap-2">
            <Textarea value={adjust} onChange={(e) => setAdjust(e.target.value)} placeholder="O que precisa mudar?" aria-label="Pedido de ajuste" />
            <div>
              <Button size="sm" disabled={pending || adjust.trim().length < 3} onClick={() => run(() => adjustPostAction(p.id, adjust), (r) => r.ok && setAdjust(null))}>
                Enviar ajuste ao agente
              </Button>
            </div>
          </div>
        )}
        <Feedback msg={msg} />
      </div>
    </article>
  );
}
