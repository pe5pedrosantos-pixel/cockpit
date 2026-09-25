"use client";

import { useEffect, useId, useState, useTransition } from "react";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  Copy,
  Globe,
  Mail,
  MessageCircle,
  Plus,
  Trash2,
} from "lucide-react";
import {
  addLeadNote,
  createLead,
  deleteLead,
  getLeadNotes,
  markLeadSeen,
  moveLead,
  updateLead,
} from "@/lib/actions/leads";
import {
  LEAD_INTERESTS,
  LEAD_SOURCES,
  LEAD_STAGES,
  OPEN_STAGES,
  stageLabel,
  whatsappLink,
} from "@/lib/leads";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { KanbanScroller } from "@/components/kanban-scroller";
import { brl, dateLabel, dateShort, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface LeadCardData {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  role: string | null;
  interest: string | null;
  message: string | null;
  stage: string;
  value: string | null;
  eventDate: string | null;
  nextStep: string | null;
  nextStepDate: string | null;
  lostReason: string | null;
  source: string;
  utmSource: string | null;
  utmCampaign: string | null;
  pageUrl: string | null;
  seen: boolean;
  createdAt: string;
}

// ─── Quadro ───────────────────────────────────────────────────────────────

export function LeadsBoard({ leads }: { leads: LeadCardData[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const open = leads.find((l) => l.id === openId) ?? null;

  return (
    <>
      <KanbanScroller stages={LEAD_STAGES.map((s) => s.label)}>
        {LEAD_STAGES.map((stage) => {
          const list = leads.filter((l) => l.stage === stage.key);
          const total = list.reduce((s, l) => s + Number(l.value ?? 0), 0);
          return (
            <div
              key={stage.key}
              className="flex w-[17rem] shrink-0 snap-start flex-col gap-2.5 rounded-xl border border-border bg-black/[0.025] p-3"
            >
              <div className="flex items-baseline justify-between px-1">
                <span className="truncate text-[12.5px] font-semibold text-ink">{stage.label}</span>
                <span className="rounded-md border border-border px-1.5 text-[11px] tabular-nums text-ink-muted">
                  {list.length}
                </span>
              </div>
              {total > 0 && (
                <p className="-mt-1.5 px-1 text-[11px] tabular-nums text-ink-muted">{brl(total)}</p>
              )}
              {list.map((l) => (
                <LeadCard key={l.id} lead={l} onOpen={() => setOpenId(l.id)} />
              ))}
              {list.length === 0 && (
                <p className="px-1 py-4 text-center text-xs text-ink-faint">Nenhum lead aqui.</p>
              )}
            </div>
          );
        })}
      </KanbanScroller>
      {open && <LeadDialog lead={open} onClose={() => setOpenId(null)} />}
    </>
  );
}

function LeadCard({ lead: l, onOpen }: { lead: LeadCardData; onOpen: () => void }) {
  const today = todayISO();
  const overdue = l.nextStepDate && l.nextStepDate < today && OPEN_STAGES.includes(l.stage as never);
  const value = Number(l.value ?? 0);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "w-full cursor-pointer rounded-lg border bg-paper p-3 text-left shadow-sm transition-shadow hover:shadow-md",
        !l.seen ? "border-coral/40" : overdue ? "border-coral/30" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{l.name}</p>
        {!l.seen && (
          <span className="shrink-0 rounded-full bg-coral px-1.5 py-0.5 text-[10px] font-semibold text-white">
            novo
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-col gap-0.5 text-[11px] text-ink-muted">
        {l.organization && (
          <span className="flex items-center gap-1.5">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{l.organization}</span>
          </span>
        )}
        <span>
          {[l.interest ? (LEAD_INTERESTS[l.interest] ?? l.interest) : null, LEAD_SOURCES[l.source] ?? l.source]
            .filter(Boolean)
            .join(", ")}
        </span>
        {l.eventDate && (
          <span className="flex items-center gap-1.5">
            <CalendarClock className="h-3 w-3 shrink-0" />
            evento em {dateShort(l.eventDate)}
          </span>
        )}
      </div>
      {(value > 0 || l.nextStep) && (
        <div className="mt-2 border-t border-border pt-2 text-[11px]">
          {value > 0 && <strong className="block text-sm tabular-nums">{brl(value)}</strong>}
          {l.nextStep && (
            <p className={cn("truncate", overdue ? "font-medium text-coral" : "text-ink-muted")}>
              {overdue ? "Atrasado: " : ""}
              {l.nextStep}
              {l.nextStepDate ? `, ${dateShort(l.nextStepDate)}` : ""}
            </p>
          )}
        </div>
      )}
    </button>
  );
}

// ─── Detalhe do lead ──────────────────────────────────────────────────────

function LeadDialog({ lead, onClose }: { lead: LeadCardData; onClose: () => void }) {
  const [notes, setNotes] = useState<{ id: number; content: string; createdAt: Date }[] | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [askLost, setAskLost] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadNotes = () => getLeadNotes(lead.id).then(setNotes).catch(() => setNotes([]));

  useEffect(() => {
    loadNotes();
    if (!lead.seen) markLeadSeen(lead.id).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  const move = (stage: string, reason?: string) =>
    startTransition(async () => {
      const r = await moveLead(lead.id, stage, reason);
      if (r.message) setMsg({ ok: r.ok, text: r.message });
      setAskLost(false);
      loadNotes();
    });

  const wa = whatsappLink(lead.phone);
  const idx = LEAD_STAGES.findIndex((s) => s.key === lead.stage);
  const next = OPEN_STAGES.includes(lead.stage as never) ? LEAD_STAGES[idx + 1] : null;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={lead.name} className="max-w-2xl">
        <p className="-mt-3 mb-4 text-[12.5px] text-ink-muted">
          {[lead.organization, lead.role, stageLabel(lead.stage)].filter(Boolean).join(", ")}
          {lead.source === "site" && `. Veio do site em ${dateLabel(lead.createdAt)}`}
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" type="button">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </Button>
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`}>
              <Button size="sm" variant="outline" type="button">
                <Mail className="h-3.5 w-3.5" /> E-mail
              </Button>
            </a>
          )}
          {next && (
            <Button size="sm" type="button" disabled={isPending} onClick={() => move(next.key)}>
              <ArrowRight className="h-3.5 w-3.5" /> {next.label}
            </Button>
          )}
        </div>

        {/* etapas */}
        <div className="mb-5 flex flex-wrap gap-1.5">
          {LEAD_STAGES.map((s) => (
            <button
              key={s.key}
              type="button"
              disabled={isPending}
              onClick={() => (s.key === "perdido" ? setAskLost(true) : move(s.key))}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 text-[11.5px] transition-colors",
                s.key === lead.stage
                  ? "border-navy bg-navy text-white"
                  : "border-border text-ink-muted hover:border-ink-muted hover:text-ink"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {askLost && (
          <div className="mb-5 flex gap-2">
            <Input
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="Motivo da perda (opcional)"
              className="h-8 text-[13px]"
            />
            <Button size="sm" type="button" onClick={() => move("perdido", lostReason)}>
              Marcar como perdido
            </Button>
          </div>
        )}
        {lead.stage === "perdido" && lead.lostReason && (
          <p className="-mt-3 mb-5 text-[12.5px] text-ink-muted">Motivo da perda: {lead.lostReason}</p>
        )}

        {lead.message && (
          <div className="mb-5 rounded-lg bg-black/[0.03] px-3 py-2.5 text-[13px] whitespace-pre-line">
            {lead.message}
          </div>
        )}

        <LeadForm
          lead={lead}
          submitLabel="Salvar"
          onSubmit={(fd) =>
            startTransition(async () => {
              const r = await updateLead(lead.id, fd);
              setMsg({ ok: r.ok, text: r.message });
            })
          }
          pending={isPending}
        />
        {msg && (
          <p className={cn("mt-2 text-[12.5px]", msg.ok ? "text-money" : "text-coral")}>{msg.text}</p>
        )}

        {/* notas */}
        <section className="mt-6 flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold">Histórico</h3>
          <div className="flex gap-2">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Registrar conversa, próximo passo…"
              className="h-9 text-[13px]"
            />
            <Button
              size="sm"
              type="button"
              disabled={isPending || !note.trim()}
              onClick={() =>
                startTransition(async () => {
                  await addLeadNote(lead.id, note);
                  setNote("");
                  loadNotes();
                })
              }
            >
              Anotar
            </Button>
          </div>
          {notes === null ? (
            <p className="text-[12.5px] text-ink-muted">Carregando…</p>
          ) : notes.length === 0 ? (
            <p className="text-[12.5px] text-ink-faint">Nada registrado ainda.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {notes.map((n) => (
                <li key={n.id} className="rounded-md border border-border px-3 py-2 text-[12.5px]">
                  <span className="mr-2 text-[11px] tabular-nums text-ink-faint">
                    {new Date(n.createdAt).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  <span className="whitespace-pre-line">{n.content}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {(lead.utmSource || lead.utmCampaign || lead.pageUrl) && (
          <p className="mt-4 text-[11px] text-ink-faint">
            Origem: {[lead.utmSource, lead.utmCampaign, lead.pageUrl].filter(Boolean).join(", ")}
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            if (confirm(`Remover ${lead.name} do funil?`))
              startTransition(async () => {
                await deleteLead(lead.id);
                onClose();
              });
          }}
          className="mt-5 inline-flex cursor-pointer items-center gap-1 text-[12px] text-ink-faint hover:text-coral"
        >
          <Trash2 className="h-3 w-3" /> Remover lead
        </button>
      </DialogContent>
    </Dialog>
  );
}

// ─── Formulário (novo e edição) ───────────────────────────────────────────

function LeadForm({
  lead,
  onSubmit,
  submitLabel,
  pending,
}: {
  lead?: LeadCardData;
  onSubmit: (fd: FormData) => void;
  submitLabel: string;
  pending: boolean;
}) {
  return (
    <form action={onSubmit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" name="name" required defaultValue={lead?.name} />
        <Field label="Empresa / organização" name="organization" defaultValue={lead?.organization} />
        <Field label="Telefone / WhatsApp" name="phone" defaultValue={lead?.phone} />
        <Field label="E-mail" name="email" type="email" defaultValue={lead?.email} />
        <Field label="Cargo" name="role" defaultValue={lead?.role} />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`l-int-${lead?.id ?? "new"}`}>Interesse</Label>
            <Select id={`l-int-${lead?.id ?? "new"}`} name="interest" defaultValue={lead?.interest ?? "palestra"}>
              {Object.entries(LEAD_INTERESTS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`l-src-${lead?.id ?? "new"}`}>Origem</Label>
            <Select id={`l-src-${lead?.id ?? "new"}`} name="source" defaultValue={lead?.source ?? "manual"}>
              {Object.entries(LEAD_SOURCES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Field label="Valor (R$)" name="value" inputMode="decimal" defaultValue={lead?.value ? String(Number(lead.value)) : ""} />
        <Field label="Data do evento" name="eventDate" type="date" defaultValue={lead?.eventDate} />
        <Field label="Próximo passo" name="nextStep" defaultValue={lead?.nextStep} placeholder="Ex.: enviar proposta" />
        <Field label="Data do próximo passo" name="nextStepDate" type="date" defaultValue={lead?.nextStepDate} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`l-msg-${lead?.id ?? "new"}`}>Contexto</Label>
        <Textarea id={`l-msg-${lead?.id ?? "new"}`} name="message" rows={3} defaultValue={lead?.message ?? ""} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando…" : submitLabel}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  ...rest
}: { label: string; name: string; defaultValue?: string | null } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "name">) {
  const id = `f-${name}-${useId()}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} defaultValue={defaultValue ?? ""} {...rest} />
    </div>
  );
}

export function NewLeadDialog() {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setMsg(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-3.5 w-3.5" /> Novo lead
        </Button>
      </DialogTrigger>
      <DialogContent title="Novo lead" className="max-w-2xl">
        <LeadForm
          submitLabel="Adicionar ao funil"
          pending={isPending}
          onSubmit={(fd) =>
            startTransition(async () => {
              const r = await createLead(fd);
              if (r.ok) setOpen(false);
              else setMsg(r.message);
            })
          }
        />
        {msg && <p className="mt-2 text-[12.5px] text-coral">{msg}</p>}
      </DialogContent>
    </Dialog>
  );
}

// ─── Conectar o site ──────────────────────────────────────────────────────

export function ConnectSiteDialog({ endpoint }: { endpoint: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const prompt = `Conecte o formulário de contato da landing page ao meu CRM.

Quando o visitante enviar o formulário, faça um POST (fetch) para:
${endpoint}

Cabeçalho: Content-Type: application/json
Corpo (JSON), com estes nomes de campo:
- name (obrigatório): nome da pessoa
- email: e-mail
- phone: WhatsApp/telefone (e-mail ou telefone é obrigatório)
- company: empresa ou organização
- role: cargo
- interest: o que a pessoa procura — use um select com as opções "Palestra", "Consultoria", "Mentoria", "Treinamento", "Outro"
- message: mensagem livre (ex.: tema, público, data prevista do evento)
- utm_source e utm_campaign: leia da URL da página (?utm_source=...&utm_campaign=...), se existirem
- page_url: window.location.href
- website: campo oculto anti-spam. Crie um input com name="website", escondido via CSS (não use type="hidden"), com tabIndex -1 e autoComplete off. Pessoas não preenchem; robôs sim.

A resposta é JSON: { "ok": true } em caso de sucesso, ou { "ok": false, "error": "mensagem" } com status 400.
Em caso de sucesso, mostre uma mensagem de agradecimento ("Recebi seu contato, retorno em breve.") e limpe o formulário.
Em caso de erro, mostre o texto de "error" abaixo do botão, sem apagar o que a pessoa digitou.
Desabilite o botão enquanto envia.`;

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Globe className="h-3.5 w-3.5" /> Conectar site
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Conectar o formulário do site"
        description="Cada envio do formulário vira um lead em Novo lead, com aviso no Dashboard."
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-4 text-[13px]">
          <div>
            <p className="mb-1.5 font-medium">Endereço que recebe os leads</p>
            <div className="flex gap-2">
              <code className="flex-1 truncate rounded-md border border-border bg-black/[0.03] px-3 py-2 text-[12px]">
                {endpoint}
              </code>
              <Button size="sm" variant="outline" type="button" onClick={() => copy(endpoint, "url")}>
                {copied === "url" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="font-medium">Prompt para colar no Lovable</p>
              <Button size="sm" variant="outline" type="button" onClick={() => copy(prompt, "prompt")}>
                {copied === "prompt" ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </>
                )}
              </Button>
            </div>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-black/[0.03] px-3 py-2 text-[11.5px] leading-relaxed">
              {prompt}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
