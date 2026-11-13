"use client";

import { useState } from "react";
import { Check, ExternalLink, Image as ImageIcon, Sparkles, Trash2, Video, Wand2 } from "lucide-react";
import {
  adjustPostAction,
  aiCaptionAction,
  approvePostsAction,
  askAgentForPostAction,
  deletePostAction,
  savePostAction,
} from "@/lib/actions/social";
import { BACKGROUNDS, POST_STATUSES, NETWORKS } from "@/lib/social/constants";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { BgSwatch, Feedback, PostStatusBadge, useAction } from "@/components/social/bits";
import { ACTOR_LABEL, when, type LineData, type PostData } from "@/components/social/types";
import { dateLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

type Form = {
  data: string;
  extra: boolean;
  linha: string;
  titulo: string;
  formato: string;
  fundo: string;
  status: string;
  redes: string[];
  horaLinkedin: string;
  horaInstagram: string;
  legendaLinkedin: string;
  legendaInstagram: string;
  primeiroComentarioLinkedin: string;
  primeiroComentarioInstagram: string;
  arteUrl: string;
  previewUrl: string;
  fonteNome: string;
  fonteUrl: string;
  notas: string;
  urlLinkedin: string;
  urlInstagram: string;
  metricoolIdLinkedin: string;
  metricoolIdInstagram: string;
};

function toForm(p: PostData | null, date: string, suggestedBg: string): Form {
  return {
    data: p?.date ?? date,
    extra: p?.extra ?? false,
    linha: p?.lineSlug ?? "",
    titulo: p?.title ?? "",
    formato: p?.format ?? "",
    fundo: p?.background ?? suggestedBg,
    status: p?.status ?? "planejado",
    redes: p?.networks ?? ["linkedin", "instagram"],
    horaLinkedin: p?.timeLinkedin ?? "17:30",
    horaInstagram: p?.timeInstagram ?? "19:00",
    legendaLinkedin: p?.captionLinkedin ?? "",
    legendaInstagram: p?.captionInstagram ?? "",
    primeiroComentarioLinkedin: p?.firstCommentLinkedin ?? "",
    primeiroComentarioInstagram: p?.firstCommentInstagram ?? "",
    arteUrl: p?.artUrl ?? "",
    previewUrl: p?.previewUrl ?? "",
    fonteNome: p?.sourceName ?? "",
    fonteUrl: p?.sourceUrl ?? "",
    notas: p?.notes ?? "",
    urlLinkedin: p?.urlLinkedin ?? "",
    urlInstagram: p?.urlInstagram ?? "",
    metricoolIdLinkedin: p?.metricoolIdLinkedin ?? "",
    metricoolIdInstagram: p?.metricoolIdInstagram ?? "",
  };
}

export function PostDialog({
  post,
  date,
  suggestedBg,
  lines,
  aiEnabled,
  neighborBgs,
  onClose,
}: {
  post: PostData | null;
  date: string;
  suggestedBg: string;
  lines: LineData[];
  aiEnabled: boolean;
  /** fundos dos posts principais do dia anterior e do seguinte */
  neighborBgs: string[];
  onClose: () => void;
}) {
  const [form, setForm] = useState<Form>(() => toForm(post, date, suggestedBg));
  const [adjust, setAdjust] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { pending, msg, run } = useAction();

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const repeatsNeighbor = !form.extra && form.fundo !== "video" && neighborBgs.includes(form.fundo);

  const save = () =>
    run(
      () =>
        savePostAction({
          ...(post ? { id: post.id } : {}),
          ...form,
          fundo: form.fundo || null,
          linha: form.linha || null,
          horaLinkedin: form.horaLinkedin || null,
          horaInstagram: form.horaInstagram || null,
        }),
      (r) => {
        if (r.ok && !post) onClose();
      }
    );

  const busy = pending;
  const canApprove = post && (post.status === "aguardando_ok" || post.status === "ajuste");

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={post ? post.title : "Novo post"} className="max-w-3xl">
        <div className="flex flex-col gap-5">
          {post && (
            <div className="-mt-3 flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
              <PostStatusBadge status={post.status} />
              <span>{dateLabel(post.date)}</span>
              <span>·</span>
              <span>
                Última mudança: {ACTOR_LABEL[post.updatedBy] ?? post.updatedBy}, {when(post.updatedAt)}
              </span>
            </div>
          )}

          {post?.pending && (
            <p className="rounded-md border border-border bg-black/[0.025] px-3 py-2 text-[12.5px] text-ink">
              <strong className="font-semibold">Pendência do agente:</strong> {post.pending}
            </p>
          )}
          {post?.status === "ajuste" && post.adjustRequest && (
            <p className="rounded-md border border-border bg-black/[0.025] px-3 py-2 text-[12.5px] text-ink">
              <strong className="font-semibold">Seu pedido de ajuste:</strong> {post.adjustRequest}
            </p>
          )}

          {/* prévia e ações de aprovação */}
          {post && (post.previewUrl || post.artUrl) && (
            <div className="flex flex-wrap items-start gap-4">
              {post.previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.previewUrl}
                  alt={`Prévia da arte: ${post.title}`}
                  className="h-44 w-auto rounded-md border border-border object-cover"
                />
              )}
              {post.artUrl && (
                <a
                  href={post.artUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-navy underline underline-offset-2"
                >
                  Abrir a arte <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}

          {canApprove && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-coral/30 bg-attention-bg p-3">
              <span className="mr-auto text-[13px] font-medium text-ink">Esta peça espera o seu OK.</span>
              <Button
                variant="coral"
                size="sm"
                disabled={busy}
                onClick={() => run(() => approvePostsAction([post.id]), (r) => r.ok && onClose())}
              >
                <Check className="h-3.5 w-3.5" /> Aprovar
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => setAdjust(adjust === null ? "" : null)}>
                Pedir ajuste
              </Button>
            </div>
          )}
          {adjust !== null && post && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="adjust">O que precisa mudar?</Label>
              <Textarea
                id="adjust"
                value={adjust}
                onChange={(e) => setAdjust(e.target.value)}
                placeholder="Ex.: trocar o gancho do slide 1, usar a foto do evento da Fenasucro"
              />
              <div>
                <Button
                  size="sm"
                  disabled={busy || adjust.trim().length < 3}
                  onClick={() => run(() => adjustPostAction(post.id, adjust), (r) => r.ok && onClose())}
                >
                  Enviar ajuste ao agente
                </Button>
              </div>
            </div>
          )}

          {/* o básico */}
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem_12rem]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="titulo">Título / gancho</Label>
              <Input id="titulo" value={form.titulo} onChange={(e) => set("titulo", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="data">Data</Label>
              <Input id="data" type="date" value={form.data} onChange={(e) => set("data", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Status</Label>
              <Select id="status" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {POST_STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="linha">Linha editorial</Label>
              <Select id="linha" value={form.linha} onChange={(e) => set("linha", e.target.value)}>
                <option value="">Sem linha</option>
                {lines.map((l) => (
                  <option key={l.slug} value={l.slug}>
                    {l.name}
                    {l.active ? "" : " (inativa)"}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="formato">Formato</Label>
              <Input
                id="formato"
                value={form.formato}
                onChange={(e) => set("formato", e.target.value)}
                placeholder="Carrossel de tese (7 slides), Reel, Card estilo X..."
                list="formatos-linha"
              />
              <datalist id="formatos-linha">
                {(lines.find((l) => l.slug === form.linha)?.formats ?? []).map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[12.5px] font-medium text-ink-muted">Fundo da peça</legend>
            <div className="flex flex-wrap gap-2">
              {BACKGROUNDS.map((b) => (
                <label
                  key={b.key}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12.5px]",
                    form.fundo === b.key ? "border-navy bg-navy/[0.06] font-semibold" : "border-border-strong"
                  )}
                >
                  <input
                    type="radio"
                    name="fundo"
                    value={b.key}
                    checked={form.fundo === b.key}
                    onChange={() => set("fundo", b.key)}
                    className="sr-only"
                  />
                  <BgSwatch value={b.key} size="md" />
                  {b.label}
                </label>
              ))}
              <label className="ml-auto flex items-center gap-2 text-[12.5px] text-ink-muted">
                <input type="checkbox" checked={form.extra} onChange={(e) => set("extra", e.target.checked)} />
                Peça extra do dia
              </label>
            </div>
            {repeatsNeighbor && (
              <p className="text-[12px] font-medium text-coral">
                Mesmo fundo de um dia vizinho. A regra da marca é nunca repetir em sequência.
              </p>
            )}
          </fieldset>

          {/* redes e legendas */}
          <div className="grid gap-4 md:grid-cols-2">
            {NETWORKS.map((n) => {
              const on = form.redes.includes(n.key);
              const captionKey = n.key === "linkedin" ? "legendaLinkedin" : "legendaInstagram";
              const commentKey = n.key === "linkedin" ? "primeiroComentarioLinkedin" : "primeiroComentarioInstagram";
              const timeKey = n.key === "linkedin" ? "horaLinkedin" : "horaInstagram";
              const len = form[captionKey].length;
              const hint = n.key === "linkedin" ? "ideal 900 a 1.500" : "até 2.200";
              return (
                <div key={n.key} className={cn("flex flex-col gap-2 rounded-lg border border-border p-3", !on && "opacity-60")}>
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-[13px] font-semibold">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) =>
                          set("redes", e.target.checked ? [...form.redes, n.key] : form.redes.filter((r) => r !== n.key))
                        }
                      />
                      {n.label}
                    </label>
                    <Input
                      aria-label={`Horário no ${n.label}`}
                      type="time"
                      value={form[timeKey]}
                      onChange={(e) => set(timeKey, e.target.value)}
                      className="h-8 w-32"
                    />
                  </div>
                  <Textarea
                    aria-label={`Legenda do ${n.label}`}
                    value={form[captionKey]}
                    onChange={(e) => set(captionKey, e.target.value)}
                    className="min-h-[180px] text-[13px] leading-relaxed"
                    placeholder={`Legenda do ${n.label}`}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11.5px] tabular-nums text-ink-faint">
                      {len} caracteres · {hint}
                    </span>
                    {aiEnabled && post && (
                      <CaptionAI
                        network={n.key}
                        onText={(t) => set(captionKey, t)}
                        draft={{ title: form.titulo, captionLinkedin: form.legendaLinkedin, captionInstagram: form.legendaInstagram }}
                        postId={post.id}
                      />
                    )}
                  </div>
                  <Input
                    aria-label={`Primeiro comentário no ${n.label}`}
                    value={form[commentKey]}
                    onChange={(e) => set(commentKey, e.target.value)}
                    placeholder="Primeiro comentário (opcional)"
                  />
                </div>
              );
            })}
          </div>

          {/* arte, fonte e notas */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="arte">Link da arte (Canva ou vídeo)</Label>
              <Input id="arte" value={form.arteUrl} onChange={(e) => set("arteUrl", e.target.value)} placeholder="https://www.canva.com/design/..." />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="preview">Imagem de prévia</Label>
              <Input id="preview" value={form.previewUrl} onChange={(e) => set("previewUrl", e.target.value)} placeholder="https://... .png" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fonte">Fonte (quando há dado)</Label>
              <Input id="fonte" value={form.fonteNome} onChange={(e) => set("fonteNome", e.target.value)} placeholder="Meio & Mensagem, 05/11/2026" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fonteUrl">Link da fonte</Label>
              <Input id="fonteUrl" value={form.fonteUrl} onChange={(e) => set("fonteUrl", e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notas">Notas</Label>
            <Textarea id="notas" value={form.notas} onChange={(e) => set("notas", e.target.value)} />
          </div>

          <details className="rounded-lg border border-border px-3 py-2">
            <summary className="cursor-pointer text-[12.5px] font-medium text-ink-muted">
              Publicação e Metricool
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="urlLi">Link do post no LinkedIn</Label>
                <Input id="urlLi" value={form.urlLinkedin} onChange={(e) => set("urlLinkedin", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="urlIg">Link do post no Instagram</Label>
                <Input id="urlIg" value={form.urlInstagram} onChange={(e) => set("urlInstagram", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mLi">Id no Metricool (LinkedIn)</Label>
                <Input id="mLi" value={form.metricoolIdLinkedin} onChange={(e) => set("metricoolIdLinkedin", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mIg">Id no Metricool (Instagram)</Label>
                <Input id="mIg" value={form.metricoolIdInstagram} onChange={(e) => set("metricoolIdInstagram", e.target.value)} />
              </div>
            </div>
          </details>

          {post && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-black/[0.02] p-3">
              <p className="text-[12.5px] font-semibold text-ink">Pedir ao agente</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => askAgentForPostAction(post.id, "arte"))}>
                  <ImageIcon className="h-3.5 w-3.5" /> Arte no Canva
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => askAgentForPostAction(post.id, "video"))}>
                  <Video className="h-3.5 w-3.5" /> Vídeo no Higgsfield
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => askAgentForPostAction(post.id, "legenda"))}>
                  <Wand2 className="h-3.5 w-3.5" /> Legendas
                </Button>
                {post.status === "aprovado" && (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => askAgentForPostAction(post.id, "agendar"))}>
                    Agendar no Metricool
                  </Button>
                )}
              </div>
            </div>
          )}

          <Feedback msg={msg} />

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            {post ? (
              confirmDelete ? (
                <span className="flex items-center gap-2 text-[12.5px]">
                  Excluir este post?
                  <Button variant="danger" size="sm" disabled={busy} onClick={() => run(() => deletePostAction(post.id), (r) => r.ok && onClose())}>
                    Excluir
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                    Cancelar
                  </Button>
                </span>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </Button>
              )
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
              <Button onClick={save} disabled={busy || form.titulo.trim().length < 2 || !form.data}>
                {busy ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Botão "Escrever com o Claude" de uma legenda, com um pedido opcional. */
function CaptionAI({
  network,
  postId,
  draft,
  onText,
}: {
  network: "linkedin" | "instagram";
  postId: number;
  draft: { title: string; captionLinkedin: string; captionInstagram: string };
  onText: (t: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const { pending, msg, run } = useAction();
  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="h-3.5 w-3.5" /> Escrever com o Claude
      </Button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex gap-1.5">
        <Input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Pedido (opcional): mais curta, outro gancho..."
          className="h-8 text-[12.5px]"
        />
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              () => aiCaptionAction(postId, network, instruction, draft),
              (r) => {
                if (r.ok && r.data) {
                  onText(r.data.text);
                  setOpen(false);
                }
              }
            )
          }
        >
          {pending ? "Escrevendo..." : "Ir"}
        </Button>
      </div>
      <Feedback msg={msg && !msg.ok ? msg : null} />
    </div>
  );
}
