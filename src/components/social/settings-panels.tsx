"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Eye, EyeOff, XCircle } from "lucide-react";
import { prepareSocialAction, saveTimesAction } from "@/lib/actions/social";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Empty, Feedback, PostStatusBadge, SectionTitle, useAction } from "@/components/social/bits";
import { when, type PostData, type RunData } from "@/components/social/types";
import { dateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─── Primeira vez: criar as tabelas ───────────────────────────────────────

export function SetupCard() {
  const { pending, msg, run } = useAction();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preparar o banco da Social Media</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-[13.5px]">
        <p className="text-ink-muted">
          As tabelas de posts, solicitações, linhas editoriais e métricas ainda não existem no banco. Um clique cria
          tudo e grava as três linhas editoriais padrão. Não mexe em nenhum dado das outras abas.
        </p>
        <div>
          <Button disabled={pending} onClick={() => run(() => prepareSocialAction())}>
            {pending ? "Preparando..." : "Preparar banco"}
          </Button>
        </div>
        <Feedback msg={msg} />
      </CardContent>
    </Card>
  );
}

// ─── Histórico ────────────────────────────────────────────────────────────

export function HistoryPanel({ runs, done }: { runs: RunData[]; done: PostData[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <section>
        <SectionTitle note="O que as rotinas do agente fizeram">Execuções do agente</SectionTitle>
        {runs.length ? (
          <ol className="flex flex-col gap-2">
            {runs.map((r) => (
              <li key={r.id} className="rounded-lg border border-border bg-paper p-3">
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 font-medium",
                      r.result === "ok" ? "bg-money/10 text-money" : r.result === "falha" ? "bg-attention-bg text-coral" : "bg-navy/10 text-navy"
                    )}
                  >
                    {r.result === "ok" ? "OK" : r.result === "falha" ? "Falhou" : "Parcial"}
                  </span>
                  <span className="font-semibold text-ink">{r.routine}</span>
                  <span className="ml-auto tabular-nums text-ink-muted">{when(r.ranAt)}</span>
                </div>
                <p className="mt-1.5 text-[13px]">{r.summary}</p>
                {r.details && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[12px] text-ink-muted">Detalhes</summary>
                    <p className="mt-1 whitespace-pre-line text-[12.5px] text-ink-muted">{r.details}</p>
                  </details>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <Empty>O agente registra aqui cada rodada (semanal, mensal, agendamentos).</Empty>
        )}
      </section>
      <section>
        <SectionTitle note="Últimos 30 dias">Agendado e publicado</SectionTitle>
        {done.length ? (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-paper">
            {done.map((p) => (
              <li key={p.id} className="flex items-start gap-3 px-3 py-2.5 text-[13px]">
                <span className="w-11 shrink-0 tabular-nums text-ink-muted">{dateShort(p.date)}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 font-medium">{p.title}</span>
                  <span className="flex flex-wrap gap-2 text-[11.5px] text-ink-muted">
                    {p.urlLinkedin && (
                      <a href={p.urlLinkedin} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                        LinkedIn
                      </a>
                    )}
                    {p.urlInstagram && (
                      <a href={p.urlInstagram} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                        Instagram
                      </a>
                    )}
                  </span>
                </span>
                <PostStatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nada agendado ou publicado nos últimos 30 dias.</Empty>
        )}
      </section>
    </div>
  );
}

// ─── Conexões ─────────────────────────────────────────────────────────────

export function ConnectionsPanel({
  aiConfigured,
  aiModel,
  mcpUrl,
  mcpSecretWeak,
  times,
}: {
  aiConfigured: boolean;
  aiModel: string;
  mcpUrl: string | null;
  mcpSecretWeak: boolean;
  times: { linkedin: string; instagram: string };
}) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [li, setLi] = useState(times.linkedin);
  const [ig, setIg] = useState(times.instagram);
  const { pending, msg, run } = useAction();

  const masked = mcpUrl ? mcpUrl.replace(/\/api\/mcp\/(.{4}).+$/, "/api/mcp/$1••••••••••••") : null;
  const copy = async () => {
    if (!mcpUrl) return;
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShow(true);
    }
  };

  const status = (ok: boolean, okText: string, noText: string, required = true) =>
    ok ? (
      <span className="flex items-center gap-1 text-xs font-medium text-money">
        <CheckCircle2 className="h-3.5 w-3.5" /> {okText}
      </span>
    ) : (
      <span className={cn("flex items-center gap-1 text-xs font-medium", required ? "text-coral" : "text-ink-muted")}>
        <XCircle className="h-3.5 w-3.5" /> {noText}
      </span>
    );

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Claude → Cockpit (conector MCP)</CardTitle>
            <p className="text-xs text-ink-muted">O agente e o chat do Claude leem e gravam esta aba por aqui.</p>
          </div>
          {status(!!mcpUrl, "Ativo", mcpSecretWeak ? "Segredo curto" : "Falta MCP_SECRET")}
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-[13px]">
          {mcpUrl ? (
            <>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-black/[0.025] p-2.5">
                <code className="min-w-0 flex-1 break-all text-[12px]">{show ? mcpUrl : masked}</code>
                <Button variant="ghost" size="sm" onClick={() => setShow(!show)} aria-label={show ? "Esconder endereço" : "Mostrar endereço"}>
                  {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="outline" size="sm" onClick={copy}>
                  <Copy className="h-3.5 w-3.5" /> {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-ink-muted">
                <li>No claude.ai, abra Configurações → Conectores → Adicionar conector personalizado.</li>
                <li>Nome: <strong className="text-ink">Pe5 Cockpit</strong>. URL: o endereço acima. Sem OAuth.</li>
                <li>Ative o conector no chat e nas rotinas agendadas de social media.</li>
              </ol>
              <p className="text-[12px] text-ink-faint">
                O endereço é a senha do conector: não compartilhe. Para trocar, mude MCP_SECRET na Vercel e atualize o conector.
              </p>
            </>
          ) : (
            <p className="text-ink-muted">
              Crie na Vercel a variável <code>MCP_SECRET</code> com pelo menos 24 caracteres aleatórios (por exemplo, o
              resultado de <code>openssl rand -hex 24</code>) e faça um novo deploy. O endereço do conector aparece aqui.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Cockpit → Claude (API da Anthropic)</CardTitle>
            <p className="text-xs text-ink-muted">Ideias, legendas, análises e respostas rápidas, direto daqui.</p>
          </div>
          {status(aiConfigured, `Ativo · ${aiModel}`, "Falta ANTHROPIC_API_KEY", false)}
        </CardHeader>
        <CardContent className="text-[13px] text-ink-muted">
          {aiConfigured ? (
            <p>
              Cada uso é cobrado pela Anthropic por tokens, à parte do seu plano do claude.ai. Para trocar o modelo,
              defina <code>ANTHROPIC_MODEL</code> na Vercel.
            </p>
          ) : (
            <p>
              Crie uma chave em console.anthropic.com (API Keys), adicione como <code>ANTHROPIC_API_KEY</code> na Vercel
              e faça um novo deploy. Sem a chave, os pedidos vão todos para a fila do agente.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metricool, Canva, Higgsfield, Instagram e LinkedIn</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-[13px] text-ink-muted">
          <p>
            O plano Starter do Metricool não tem API, e Instagram e LinkedIn só recebem posts pelo Metricool. Por isso
            agendar, trazer métricas, criar arte no Canva e vídeo no Higgsfield são solicitações que o agente executa
            com os conectores dele no Claude. Você pede aqui; ele faz e marca como concluído.
          </p>
          <p>Se um dia o Metricool subir para o plano Advanced, dá para ligar a API dele direto no cockpit.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Horários padrão</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-li">LinkedIn</Label>
              <Input id="t-li" type="time" value={li} onChange={(e) => setLi(e.target.value)} className="w-32" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-ig">Instagram</Label>
              <Input id="t-ig" type="time" value={ig} onChange={(e) => setIg(e.target.value)} className="w-32" />
            </div>
            <Button variant="outline" disabled={pending} onClick={() => run(() => saveTimesAction(li, ig))}>
              Salvar horários
            </Button>
          </div>
          <Feedback msg={msg} />
        </CardContent>
      </Card>
    </div>
  );
}
