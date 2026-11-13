"use client";

import { useState } from "react";
import { CalendarPlus, Check, Pencil, Plus, Sparkles, X } from "lucide-react";
import {
  aiIdeasAction,
  createRequestAction,
  ideaToPostAction,
  saveLineAction,
  setIdeaStatusAction,
} from "@/lib/actions/social";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Feedback, useAction } from "@/components/social/bits";
import type { IdeaData, LineData } from "@/components/social/types";
import { cn } from "@/lib/utils";

export function LinesPanel({
  lines,
  ideas,
  counts,
  aiEnabled,
  today,
}: {
  lines: LineData[];
  ideas: IdeaData[];
  /** posts por linha: no mês e nos próximos 30 dias */
  counts: Record<string, { month: number; next30: number }>;
  aiEnabled: boolean;
  today: string;
}) {
  const [editing, setEditing] = useState<LineData | "new" | null>(null);
  const loose = ideas.filter((i) => !i.lineSlug || !lines.some((l) => l.slug === i.lineSlug));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="h-3.5 w-3.5" /> Nova linha
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {lines.map((l) => (
          <LineCard
            key={l.slug}
            line={l}
            ideas={ideas.filter((i) => i.lineSlug === l.slug)}
            count={counts[l.slug] ?? { month: 0, next30: 0 }}
            aiEnabled={aiEnabled}
            today={today}
            onEdit={() => setEditing(l)}
          />
        ))}
      </div>
      {loose.length > 0 && (
        <section className="rounded-xl border border-border bg-paper p-4">
          <h3 className="mb-2 text-[13px] font-semibold">Ideias sem linha</h3>
          <div className="flex flex-col gap-2">
            {loose.map((i) => (
              <IdeaRow key={i.id} idea={i} today={today} />
            ))}
          </div>
        </section>
      )}
      {editing && <LineDialog line={editing === "new" ? null : editing} nextPosition={lines.length + 1} onClose={() => setEditing(null)} />}
    </div>
  );
}

function LineCard({
  line: l,
  ideas,
  count,
  aiEnabled,
  today,
  onEdit,
}: {
  line: LineData;
  ideas: IdeaData[];
  count: { month: number; next30: number };
  aiEnabled: boolean;
  today: string;
  onEdit: () => void;
}) {
  const [gen, setGen] = useState(false);
  const [n, setN] = useState("5");
  const [hint, setHint] = useState("");
  const { pending, msg, run } = useAction();

  return (
    <article className={cn("flex flex-col overflow-hidden rounded-xl border border-border bg-paper", !l.active && "opacity-60")}>
      <div className="h-1.5" style={{ backgroundColor: l.color }} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-[15px] font-semibold leading-tight">{l.name}</h3>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              {l.active ? l.frequency ?? "Sem frequência definida" : "Inativa"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`Editar ${l.name}`}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-black/[0.03] px-2.5 py-2">
            <p className="font-display text-[20px] font-extrabold tabular-nums leading-none">{count.month}</p>
            <p className="mt-1 text-[11.5px] text-ink-muted">posts no mês</p>
          </div>
          <div className="rounded-md bg-black/[0.03] px-2.5 py-2">
            <p className="font-display text-[20px] font-extrabold tabular-nums leading-none">{count.next30}</p>
            <p className="mt-1 text-[11.5px] text-ink-muted">nos próximos 30 dias</p>
          </div>
        </div>
        {l.objective && (
          <p className="text-[12.5px] leading-relaxed">
            <span className="font-semibold">Objetivo: </span>
            {l.objective}
          </p>
        )}
        {l.scope && (
          <p className="text-[12.5px] leading-relaxed text-ink-muted">
            <span className="font-semibold text-ink">O que entra: </span>
            {l.scope}
          </p>
        )}
        {l.formats.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {l.formats.map((f) => (
              <span key={f} className="rounded border border-border-strong px-1.5 py-0.5 text-[11px] text-ink-muted">
                {f}
              </span>
            ))}
          </div>
        )}

        <div className="mt-1 border-t border-border pt-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12.5px] font-semibold">Ideias ({ideas.length})</p>
            <button type="button" onClick={() => setGen(!gen)} className="cursor-pointer text-[12px] font-medium text-navy underline underline-offset-2">
              {gen ? "Fechar" : "Mais ideias"}
            </button>
          </div>
          {gen && (
            <div className="mb-3 flex flex-col gap-2 rounded-md border border-border p-2.5">
              <div className="flex gap-2">
                <Select value={n} onChange={(e) => setN(e.target.value)} className="h-8 w-20" aria-label="Quantidade de ideias">
                  {["3", "5", "8"].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
                <Input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Direção (opcional)" className="h-8 text-[12.5px]" />
              </div>
              <div className="flex flex-wrap gap-2">
                {aiEnabled && (
                  <Button size="sm" disabled={pending} onClick={() => run(() => aiIdeasAction(l.slug, Number(n), hint), (r) => r.ok && setHint(""))}>
                    <Sparkles className="h-3.5 w-3.5" /> {pending ? "Pensando..." : "Gerar agora com o Claude"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      createRequestAction({
                        titulo: `${n} ideias para a linha ${l.name}`,
                        detalhes: `Pesquisar o que está em alta e sugerir ${n} ideias para "${l.name}" com fonte quando houver dado. Salvar com salvar_ideias (linha: ${l.slug}).${hint ? `\nDireção do Pedro: ${hint}` : ""}`,
                        tipo: "ideias",
                        destino: "claude",
                        prioridade: "normal",
                      })
                    )
                  }
                >
                  Pedir ao agente (com pesquisa)
                </Button>
              </div>
            </div>
          )}
          <Feedback msg={msg} className="mb-2" />
          <div className="flex flex-col gap-2">
            {ideas.slice(0, 8).map((i) => (
              <IdeaRow key={i.id} idea={i} today={today} />
            ))}
            {!ideas.length && <p className="text-[12px] text-ink-faint">Sem ideias guardadas.</p>}
          </div>
        </div>
      </div>
    </article>
  );
}

function IdeaRow({ idea: i, today }: { idea: IdeaData; today: string }) {
  const [date, setDate] = useState<string | null>(null);
  const { pending, msg, run } = useAction();
  return (
    <div className={cn("rounded-md border p-2.5", i.status === "aprovada" ? "border-navy/30 bg-navy/[0.03]" : "border-border")}>
      <p className="text-[13px] font-medium leading-snug">{i.title}</p>
      {i.hook && <p className="mt-0.5 text-[12px] italic text-ink-muted">“{i.hook}”</p>}
      {(i.format || i.details) && (
        <p className="mt-1 text-[12px] text-ink-muted">
          {i.format ? <span className="font-medium text-ink">{i.format}. </span> : null}
          {i.details}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {date === null ? (
          <>
            <Button variant="outline" size="sm" className="h-7 px-2 text-[12px]" disabled={pending} onClick={() => setDate(today)}>
              <CalendarPlus className="h-3.5 w-3.5" /> Calendário
            </Button>
            {i.status !== "aprovada" && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-[12px]" disabled={pending} onClick={() => run(() => setIdeaStatusAction(i.id, "aprovada"))}>
                <Check className="h-3.5 w-3.5" /> Guardar
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[12px]" disabled={pending} onClick={() => run(() => setIdeaStatusAction(i.id, "descartada"))}>
              <X className="h-3.5 w-3.5" /> Descartar
            </Button>
          </>
        ) : (
          <>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-7 w-40 text-[12px]" aria-label="Data do post" />
            <Button size="sm" className="h-7 px-2 text-[12px]" disabled={pending || !date} onClick={() => run(() => ideaToPostAction(i.id, date))}>
              Criar post
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[12px]" onClick={() => setDate(null)}>
              Cancelar
            </Button>
          </>
        )}
      </div>
      <Feedback msg={msg && !msg.ok ? msg : null} className="mt-2" />
    </div>
  );
}

function LineDialog({ line, nextPosition, onClose }: { line: LineData | null; nextPosition: number; onClose: () => void }) {
  const [f, setF] = useState({
    slug: line?.slug ?? "",
    nome: line?.name ?? "",
    cor: line?.color ?? "#3D5A99",
    ativa: line?.active ?? true,
    frequencia: line?.frequency ?? "",
    objetivo: line?.objective ?? "",
    oQueEntra: line?.scope ?? "",
    formatos: (line?.formats ?? []).join("\n"),
  });
  const { pending, msg, run } = useAction();
  const slugFromName = (name: string) =>
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={line ? `Editar ${line.name}` : "Nova linha editorial"}>
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ln-nome">Nome</Label>
              <Input
                id="ln-nome"
                value={f.nome}
                onChange={(e) => setF({ ...f, nome: e.target.value, slug: line ? f.slug : slugFromName(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ln-cor">Cor</Label>
              <Input id="ln-cor" type="color" value={f.cor} onChange={(e) => setF({ ...f, cor: e.target.value })} className="h-9 p-1" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ln-freq">Frequência</Label>
              <Input id="ln-freq" value={f.frequencia} onChange={(e) => setF({ ...f, frequencia: e.target.value })} placeholder="2 posts por semana" />
            </div>
            <label className="flex items-end gap-2 pb-2 text-[13px]">
              <input type="checkbox" checked={f.ativa} onChange={(e) => setF({ ...f, ativa: e.target.checked })} />
              Linha ativa
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ln-obj">Objetivo</Label>
            <Textarea id="ln-obj" value={f.objetivo} onChange={(e) => setF({ ...f, objetivo: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ln-entra">O que entra</Label>
            <Textarea id="ln-entra" value={f.oQueEntra} onChange={(e) => setF({ ...f, oQueEntra: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ln-formatos">Formatos (um por linha)</Label>
            <Textarea id="ln-formatos" value={f.formatos} onChange={(e) => setF({ ...f, formatos: e.target.value })} />
          </div>
          <Feedback msg={msg} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              disabled={pending || f.nome.trim().length < 2 || f.slug.length < 2}
              onClick={() =>
                run(
                  () =>
                    saveLineAction({
                      slug: f.slug,
                      nome: f.nome,
                      cor: f.cor,
                      ativa: f.ativa,
                      frequencia: f.frequencia,
                      objetivo: f.objetivo,
                      oQueEntra: f.oQueEntra,
                      formatos: f.formatos.split("\n").map((s) => s.trim()).filter(Boolean),
                      ...(line ? {} : { ordem: nextPosition }),
                    }),
                  (r) => r.ok && onClose()
                )
              }
            >
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
