"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp, ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { aiAnalyzeAction, createRequestAction, requestMetricsAction } from "@/lib/actions/social";
import { WEEKDAYS_SHORT } from "@/lib/social/constants";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/ui/card";
import { Empty, Feedback, SectionTitle, useAction } from "@/components/social/bits";
import { ACTOR_LABEL, when, type AnalysisData, type MetricData } from "@/components/social/types";
import { cn } from "@/lib/utils";

type Net = "todas" | "instagram" | "linkedin";

const nf = new Intl.NumberFormat("pt-BR");
const n = (v: number | null) => v ?? 0;
const engagement = (m: MetricData) => n(m.likes) + n(m.comments) + n(m.saves) + n(m.shares);
/** Base da taxa: alcance; no LinkedIn, quando não há alcance, as impressões. */
const base = (m: MetricData) => m.reach || m.impressions || 0;
const rate = (m: MetricData) => (base(m) ? (engagement(m) / base(m)) * 100 : null);
const isVideo = (m: MetricData) => m.avgWatchSeconds != null || /reel|video|vídeo/i.test(m.kind ?? "");

function median(values: number[]) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function pct(v: number | null) {
  return v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function weekdayIdx(iso: string) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(new Date(iso));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

export function AnalyticsPanel({
  metrics,
  analyses,
  aiEnabled,
  lastSync,
  metricsRequestOpen,
  now,
}: {
  metrics: MetricData[];
  analyses: AnalysisData[];
  aiEnabled: boolean;
  lastSync: string | null;
  metricsRequestOpen: boolean;
  /** hora do servidor: o mesmo corte no servidor e no navegador */
  now: number;
}) {
  const [net, setNet] = useState<Net>("todas");
  const [days, setDays] = useState(30);
  const { pending, msg, run } = useAction();

  const rows = useMemo(() => {
    const since = now - days * 86_400_000;
    return metrics.filter(
      (m) => (net === "todas" || m.network === net) && m.publishedAt && new Date(m.publishedAt).getTime() >= since
    );
  }, [metrics, net, days, now]);

  const totals = useMemo(() => {
    const sum = (f: (m: MetricData) => number) => rows.reduce((s, m) => s + f(m), 0);
    const rates = rows.map(rate).filter((r): r is number => r != null);
    const videos = rows.filter((m) => m.avgWatchSeconds != null);
    return {
      posts: rows.length,
      reach: sum(base),
      engagement: sum(engagement),
      medianRate: rates.length ? median(rates) : null,
      saves: sum((m) => n(m.saves)),
      shares: sum((m) => n(m.shares)),
      comments: sum((m) => n(m.comments)),
      avgWatch: videos.length ? videos.reduce((s, m) => s + n(m.avgWatchSeconds), 0) / videos.length : null,
    };
  }, [rows]);

  const byGroup = (key: (m: MetricData) => string | null) => {
    const map = new Map<string, { count: number; rates: number[] }>();
    for (const m of rows) {
      const k = key(m);
      const r = rate(m);
      if (k == null || r == null) continue;
      const g = map.get(k) ?? { count: 0, rates: [] };
      g.count++;
      g.rates.push(r);
      map.set(k, g);
    }
    return [...map.entries()].map(([label, g]) => ({ label, count: g.count, value: median(g.rates) }));
  };
  const byFormat = byGroup((m) => (m.kind ? m.kind.toLowerCase() : "post")).sort((a, b) => b.value - a.value);
  const byDay = byGroup((m) => (m.publishedAt ? String(weekdayIdx(m.publishedAt)) : null))
    .map((g) => ({ ...g, label: WEEKDAYS_SHORT[Number(g.label)], order: (Number(g.label) + 6) % 7 }))
    .sort((a, b) => a.order - b.order);

  const latest = analyses[0];

  return (
    <div className="flex flex-col gap-6">
      {/* filtros numa linha, acima de tudo */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={net}
          onChange={(v) => setNet(v as Net)}
          options={[
            ["todas", "Todas as redes"],
            ["instagram", "Instagram"],
            ["linkedin", "LinkedIn"],
          ]}
        />
        <Segmented
          value={String(days)}
          onChange={(v) => setDays(Number(v))}
          options={[
            ["30", "30 dias"],
            ["60", "60 dias"],
            ["90", "90 dias"],
          ]}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-ink-muted">
            {lastSync ? `Métricas de ${when(lastSync)}` : "Sem métricas ainda"}
          </span>
          <Button variant="outline" size="sm" disabled={pending || metricsRequestOpen} onClick={() => run(() => requestMetricsAction())}>
            <RefreshCw className="h-3.5 w-3.5" /> {metricsRequestOpen ? "Pedido na fila do agente" : "Atualizar pelo agente"}
          </Button>
        </div>
      </div>
      <Feedback msg={msg} />

      {!rows.length ? (
        <Empty>
          {metrics.length
            ? "Nenhuma publicação com métricas neste filtro."
            : "As métricas chegam pelo agente: ele lê o Metricool e grava aqui. Clique em “Atualizar pelo agente”."}
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Publicações" value={totals.posts} />
            <Stat label="Alcance somado" value={nf.format(totals.reach)} note="no LinkedIn, impressões" />
            <Stat label="Interações" value={nf.format(totals.engagement)} note="curtidas, comentários, salvos e compartilhamentos" />
            <Stat label="Taxa de interação (mediana)" value={pct(totals.medianRate)} note="interações ÷ alcance, por post" />
            <Stat label="Comentários" value={nf.format(totals.comments)} />
            <Stat label="Salvos" value={nf.format(totals.saves)} />
            <Stat label="Compartilhamentos" value={nf.format(totals.shares)} />
            <Stat
              label="Tempo médio nos vídeos"
              value={totals.avgWatch == null ? "Sem vídeos" : `${totals.avgWatch.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`}
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <BarList title="Taxa de interação por formato" note="mediana por post" items={byFormat} />
            <BarList title="Taxa de interação por dia" note="mediana por post" items={byDay} />
          </div>

          <PostsTable rows={rows} />
        </>
      )}

      {/* leituras com pontos de melhoria */}
      <section>
        <SectionTitle
          note={
            <span className="flex flex-wrap items-center gap-2">
              {aiEnabled && (
                <Button size="sm" disabled={pending || rows.length < 3} onClick={() => run(() => aiAnalyzeAction(days))}>
                  <Sparkles className="h-3.5 w-3.5" /> {pending ? "Analisando..." : `Analisar ${days} dias com o Claude`}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    createRequestAction({
                      titulo: `Análise de desempenho dos últimos ${days} dias`,
                      detalhes:
                        "Ler as métricas no Metricool, comparar formatos, linhas, dias e ganchos, e registrar com registrar_analise os pontos de melhoria. Usar a análise no próximo calendário.",
                      tipo: "analise",
                      destino: "claude",
                      prioridade: "normal",
                    })
                  )
                }
              >
                Pedir ao agente
              </Button>
            </span>
          }
        >
          Pontos de melhoria
        </SectionTitle>
        {latest ? (
          <div className="flex flex-col gap-3">
            <AnalysisCard a={latest} />
            {analyses.length > 1 && (
              <details>
                <summary className="cursor-pointer text-[12.5px] text-ink-muted">Leituras anteriores ({analyses.length - 1})</summary>
                <div className="mt-3 flex flex-col gap-3">
                  {analyses.slice(1).map((a) => (
                    <AnalysisCard key={a.id} a={a} />
                  ))}
                </div>
              </details>
            )}
          </div>
        ) : (
          <Empty>Nenhuma leitura ainda. Com pelo menos 3 publicações medidas, o Claude aponta o que melhorar.</Empty>
        )}
      </section>
    </div>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="inline-flex rounded-md border border-border-strong bg-paper p-0.5 text-[12.5px]">
      {options.map(([k, label]) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          aria-pressed={value === k}
          className={cn("cursor-pointer rounded px-2.5 py-1", value === k ? "bg-navy text-on-navy" : "text-ink-muted hover:text-ink")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Barras horizontais de uma série só: um tom, rótulos em tinta, dica ao passar o mouse. */
function BarList({ title, note, items }: { title: string; note: string; items: { label: string; value: number; count: number }[] }) {
  const max = Math.max(...items.map((i) => i.value), 0.0001);
  return (
    <section className="rounded-xl border border-border bg-paper p-4">
      <SectionTitle note={note}>{title}</SectionTitle>
      {items.length ? (
        <ul className="flex flex-col gap-2">
          {items.map((i) => (
            <li
              key={i.label}
              className="group relative grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-2 text-[12.5px]"
              title={`${i.label}: ${pct(i.value)} em ${i.count} post${i.count > 1 ? "s" : ""}`}
            >
              <span className="truncate capitalize text-ink-muted">{i.label}</span>
              <span className="h-3 rounded-r-[4px] bg-navy/85 group-hover:bg-navy" style={{ width: `${Math.max((i.value / max) * 100, 2)}%` }} />
              <span className="text-right tabular-nums text-ink">{pct(i.value)}</span>
              <span className="pointer-events-none absolute -top-7 left-24 z-10 hidden rounded bg-navy px-2 py-1 text-[11px] text-on-navy group-hover:block">
                {i.count} post{i.count > 1 ? "s" : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-ink-faint">Sem dados com alcance para calcular.</p>
      )}
    </section>
  );
}

type SortKey = "date" | "reach" | "engagement" | "rate" | "saves" | "shares" | "comments" | "watch";

function PostsTable({ rows }: { rows: MetricData[] }) {
  const [sort, setSort] = useState<SortKey>("date");
  const value = (m: MetricData): number => {
    switch (sort) {
      case "date":
        return m.publishedAt ? new Date(m.publishedAt).getTime() : 0;
      case "reach":
        return base(m);
      case "engagement":
        return engagement(m);
      case "rate":
        return rate(m) ?? -1;
      case "saves":
        return n(m.saves);
      case "shares":
        return n(m.shares);
      case "comments":
        return n(m.comments);
      case "watch":
        return m.avgWatchSeconds ?? -1;
    }
  };
  const sorted = [...rows].sort((a, b) => value(b) - value(a));
  const medianRate = median(rows.map(rate).filter((r): r is number => r != null));
  const th = (key: SortKey, label: string) => (
    <th className="px-2 py-2 text-right font-medium">
      <button type="button" onClick={() => setSort(key)} className={cn("inline-flex cursor-pointer items-center gap-1", sort === key && "font-semibold text-ink")}>
        {label}
        {sort === key && <ArrowDownUp className="h-3 w-3" />}
      </button>
    </th>
  );
  return (
    <section>
      <SectionTitle note="Clique no título da coluna para ordenar">Publicações</SectionTitle>
      <div className="overflow-x-auto rounded-xl border border-border bg-paper">
        <table className="w-full min-w-[760px] text-[12.5px]">
          <thead className="border-b border-border text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">
                <button type="button" onClick={() => setSort("date")} className={cn("cursor-pointer", sort === "date" && "font-semibold text-ink")}>
                  Publicação
                </button>
              </th>
              {th("reach", "Alcance")}
              {th("engagement", "Interações")}
              {th("rate", "Taxa")}
              {th("comments", "Coment.")}
              {th("saves", "Salvos")}
              {th("shares", "Compart.")}
              {th("watch", "Tempo médio")}
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              const r = rate(m);
              return (
                <tr key={m.id} className="border-b border-border/60 last:border-0">
                  <td className="max-w-[18rem] px-3 py-2">
                    <a href={m.url} target="_blank" rel="noreferrer" className="group flex items-start gap-1.5">
                      <span className="mt-0.5 shrink-0 rounded bg-black/[0.05] px-1 text-[10px] font-semibold uppercase text-ink-muted">
                        {m.network === "instagram" ? "IG" : "LI"}
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-1 group-hover:underline">{m.text || m.url}</span>
                        <span className="text-[11px] text-ink-faint">
                          {m.publishedAt ? when(m.publishedAt) : "—"} · {m.kind ?? "post"}
                        </span>
                      </span>
                      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-ink-faint" />
                    </a>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{nf.format(base(m))}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{nf.format(engagement(m))}</td>
                  <td className={cn("px-2 py-2 text-right tabular-nums", r != null && r >= medianRate * 1.5 && "font-semibold text-money")}>{pct(r)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{nf.format(n(m.comments))}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{nf.format(n(m.saves))}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{nf.format(n(m.shares))}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {isVideo(m) && m.avgWatchSeconds != null
                      ? `${m.avgWatchSeconds.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s${m.viewRate != null ? ` · ${pct(m.viewRate)}` : ""}`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[11.5px] text-ink-faint">Em verde: taxa 50% acima da mediana do filtro.</p>
    </section>
  );
}

function AnalysisCard({ a }: { a: AnalysisData }) {
  return (
    <article className="rounded-xl border border-border bg-paper p-4">
      <p className="text-[11.5px] text-ink-muted">
        {a.period ?? "Leitura"} · {ACTOR_LABEL[a.source] ?? a.source} · {when(a.createdAt)}
      </p>
      <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed">{a.summary}</p>
      {a.points.length > 0 && (
        <ol className="mt-3 grid gap-2 md:grid-cols-2">
          {a.points.map((p, i) => (
            <li key={i} className="rounded-lg border border-border p-3">
              <p className="text-[13px] font-semibold">
                {i + 1}. {p.titulo}
              </p>
              <p className="mt-1 text-[12.5px] text-ink-muted">{p.detalhe}</p>
              {p.acao && (
                <p className="mt-1.5 text-[12.5px]">
                  <span className="font-semibold">Ação: </span>
                  {p.acao}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
