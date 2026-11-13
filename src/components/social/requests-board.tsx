"use client";

import { useState } from "react";
import { Bot, ChevronDown, ExternalLink, Plus, Sparkles, User } from "lucide-react";
import {
  aiAnswerRequestAction,
  createRequestAction,
  deleteRequestAction,
  updateRequestAction,
} from "@/lib/actions/social";
import { REQUEST_KINDS, TARGETS, kindLabel, requestStatusLabel, targetLabel } from "@/lib/social/constants";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Empty, Feedback, SectionTitle, useAction } from "@/components/social/bits";
import { ACTOR_LABEL, when, type PostData, type RequestData } from "@/components/social/types";
import { dateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Kinds que o Claude do cockpit consegue resolver só com texto. */
const AI_KINDS = ["legenda", "ideias", "pesquisa", "analise", "outro"];

export function RequestsBoard({
  requests,
  posts,
  aiEnabled,
}: {
  requests: RequestData[];
  posts: PostData[];
  aiEnabled: boolean;
}) {
  const [showClosed, setShowClosed] = useState(false);
  const isOpen = (r: RequestData) => r.status === "aberta" || r.status === "em_andamento";
  const list = requests.filter((r) => (showClosed ? !isOpen(r) : isOpen(r)));
  const toClaude = list.filter((r) => r.direction === "para_claude");
  const toPedro = list.filter((r) => r.direction === "para_pedro");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-border-strong bg-paper p-0.5 text-[12.5px]">
          {[false, true].map((closed) => (
            <button
              key={String(closed)}
              type="button"
              onClick={() => setShowClosed(closed)}
              className={cn(
                "cursor-pointer rounded px-3 py-1",
                showClosed === closed ? "bg-navy text-on-navy" : "text-ink-muted hover:text-ink"
              )}
            >
              {closed ? "Concluídas e canceladas" : "Abertas"}
            </button>
          ))}
        </div>
        <NewRequestDialog posts={posts} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <SectionTitle note="O agente pega na próxima rodada">
            <span className="flex items-center gap-1.5">
              <Bot className="h-4 w-4" /> Para o Claude
            </span>
          </SectionTitle>
          <div className="flex flex-col gap-2.5">
            {toClaude.map((r) => (
              <RequestCard key={r.id} r={r} aiEnabled={aiEnabled} />
            ))}
            {!toClaude.length && <Empty>{showClosed ? "Nada concluído ainda." : "Nenhum pedido aberto para o agente."}</Empty>}
          </div>
        </section>
        <section>
          <SectionTitle note="Pedidos do agente para você">
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4" /> Para você
            </span>
          </SectionTitle>
          <div className="flex flex-col gap-2.5">
            {toPedro.map((r) => (
              <RequestCard key={r.id} r={r} aiEnabled={aiEnabled} />
            ))}
            {!toPedro.length && <Empty>{showClosed ? "Nada respondido ainda." : "O agente não está esperando nada de você."}</Empty>}
          </div>
        </section>
      </div>
    </div>
  );
}

function RequestCard({ r, aiEnabled }: { r: RequestData; aiEnabled: boolean }) {
  const [expanded, setExpanded] = useState(r.direction === "para_pedro" && r.status === "aberta");
  const [answer, setAnswer] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { pending, msg, run } = useAction();
  const open = r.status === "aberta" || r.status === "em_andamento";
  const needsPedro = r.direction === "para_pedro" && open;

  return (
    <article className={cn("rounded-lg border bg-paper", needsPedro ? "border-coral/40" : "border-border")}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full cursor-pointer items-start gap-3 p-3 text-left"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded bg-black/[0.05] px-1.5 py-0.5 font-medium text-ink-muted">{kindLabel(r.kind)}</span>
            {r.direction === "para_claude" && (
              <span className="rounded border border-border-strong px-1.5 py-0.5 text-ink-muted">{targetLabel(r.target)}</span>
            )}
            {r.priority === "alta" && open && (
              <span className="rounded bg-navy/10 px-1.5 py-0.5 font-semibold text-navy">prioridade alta</span>
            )}
            {r.status === "em_andamento" && (
              <span className="rounded bg-navy/10 px-1.5 py-0.5 font-medium text-navy">em andamento</span>
            )}
            {!open && (
              <span className={cn("rounded px-1.5 py-0.5 font-medium", r.status === "concluida" ? "bg-money/10 text-money" : "bg-black/[0.05] text-ink-faint")}>
                {requestStatusLabel(r.status)}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[13.5px] font-medium leading-snug">{r.title}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">
            {ACTOR_LABEL[r.createdBy] ?? r.createdBy}, {when(r.createdAt)}
            {r.dueDate ? ` · prazo ${dateShort(r.dueDate)}` : ""}
            {r.postTitle ? ` · post de ${dateShort(r.postDate)}` : ""}
          </p>
        </div>
        <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-ink-faint transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-border px-3 pb-3 pt-3">
          {r.details && <p className="whitespace-pre-line text-[13px] text-ink">{r.details}</p>}
          {r.result && (
            <div className="rounded-md bg-black/[0.03] p-2.5">
              <p className="mb-1 text-[11.5px] font-semibold text-ink-muted">Resultado</p>
              <p className="whitespace-pre-line text-[13px] leading-relaxed">{r.result}</p>
            </div>
          )}
          {r.resultUrl && (
            <a href={r.resultUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-navy underline underline-offset-2">
              Abrir o resultado <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {needsPedro && (
            <div className="flex flex-col gap-2">
              <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Sua resposta para o agente" aria-label="Resposta" />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(() => updateRequestAction({ id: r.id, status: "concluida", resultado: answer.trim() || "Feito.", nota: "Respondida pelo Pedro" }))
                  }
                >
                  {answer.trim() ? "Responder e concluir" : "Marcar como feito"}
                </Button>
              </div>
            </div>
          )}

          {open && r.direction === "para_claude" && (
            <div className="flex flex-wrap gap-2">
              {aiEnabled && r.target === "claude" && AI_KINDS.includes(r.kind) && (
                <Button size="sm" disabled={pending} onClick={() => run(() => aiAnswerRequestAction(r.id))}>
                  <Sparkles className="h-3.5 w-3.5" /> {pending ? "O Claude está escrevendo..." : "Resolver agora com o Claude"}
                </Button>
              )}
              <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => updateRequestAction({ id: r.id, status: "concluida", nota: "Concluída pelo Pedro" }))}>
                Marcar concluída
              </Button>
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => updateRequestAction({ id: r.id, status: "cancelada", nota: "Cancelada pelo Pedro" }))}>
                Cancelar pedido
              </Button>
            </div>
          )}

          {!open && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => updateRequestAction({ id: r.id, status: "aberta", nota: "Reaberta pelo Pedro" }))}>
                Reabrir
              </Button>
              {confirmDelete ? (
                <>
                  <Button variant="danger" size="sm" disabled={pending} onClick={() => run(() => deleteRequestAction(r.id))}>
                    Excluir de vez
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                    Manter
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                  Excluir
                </Button>
              )}
            </div>
          )}

          <Feedback msg={msg} />

          {r.log.length > 0 && (
            <details>
              <summary className="cursor-pointer text-[11.5px] text-ink-muted">Histórico ({r.log.length})</summary>
              <ol className="mt-1.5 flex flex-col gap-1 text-[11.5px] text-ink-muted">
                {r.log
                  .slice()
                  .reverse()
                  .map((l, i) => (
                    <li key={i}>
                      <span className="tabular-nums">{when(l.at)}</span> · {ACTOR_LABEL[l.by] ?? l.by}: {l.text}
                    </li>
                  ))}
              </ol>
            </details>
          )}
        </div>
      )}
    </article>
  );
}

export function NewRequestDialog({ posts, defaultKind, label }: { posts: PostData[]; defaultKind?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const empty = { titulo: "", detalhes: "", tipo: defaultKind ?? "outro", destino: "claude", postId: "", prioridade: "normal", prazo: "" };
  const [f, setF] = useState(empty);
  const { pending, msg, setMsg, run } = useAction();

  const submit = () =>
    run(
      () =>
        createRequestAction({
          titulo: f.titulo,
          detalhes: f.detalhes || null,
          tipo: f.tipo,
          destino: f.destino,
          postId: f.postId ? Number(f.postId) : null,
          prioridade: f.prioridade,
          prazo: f.prazo || null,
        }),
      (r) => {
        if (r.ok) {
          setF(empty);
          setOpen(false);
        }
      }
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setMsg(null);
      }}
    >
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> {label ?? "Nova solicitação"}
      </Button>
      <DialogContent title="Nova solicitação" description="O agente lê a fila pelo conector do cockpit.">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rq-titulo">O que você precisa?</Label>
            <Input id="rq-titulo" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Reel com o corte do Networking Talks com a Ana" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rq-tipo">Tipo</Label>
              <Select id="rq-tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
                {REQUEST_KINDS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rq-destino">Onde executar</Label>
              <Select id="rq-destino" value={f.destino} onChange={(e) => setF({ ...f, destino: e.target.value })}>
                {TARGETS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.key === "pedro" ? "Lembrete para mim" : t.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rq-detalhes">Detalhes</Label>
            <Textarea id="rq-detalhes" value={f.detalhes} onChange={(e) => setF({ ...f, detalhes: e.target.value })} placeholder="Contexto, referências, links, o que não pode faltar" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5 sm:col-span-3">
              <Label htmlFor="rq-post">Post ligado (opcional)</Label>
              <Select id="rq-post" value={f.postId} onChange={(e) => setF({ ...f, postId: e.target.value })}>
                <option value="">Nenhum</option>
                {posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {dateShort(p.date)} · {p.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rq-prio">Prioridade</Label>
              <Select id="rq-prio" value={f.prioridade} onChange={(e) => setF({ ...f, prioridade: e.target.value })}>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="rq-prazo">Prazo</Label>
              <Input id="rq-prazo" type="date" value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} />
            </div>
          </div>
          <Feedback msg={msg} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={pending || f.titulo.trim().length < 3} onClick={submit}>
              {pending ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
