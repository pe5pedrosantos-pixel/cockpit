"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { ROTATION, WEEKDAYS_SHORT, addDays, background, weekdayOf } from "@/lib/social/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PostDialog } from "@/components/social/post-dialog";
import { BgSwatch, LineDot, PostStatusBadge, SectionTitle } from "@/components/social/bits";
import type { LineData, PostData } from "@/components/social/types";
import { daysInMonth, monthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

function shiftMonth(monthRef: string, delta: number) {
  const [y, m] = monthRef.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function mainOf(posts: PostData[], date: string) {
  return posts.find((p) => p.date === date && !p.extra && p.status !== "cancelado");
}

/** Mesmo critério do servidor: um fundo diferente dos dias vizinhos. */
function suggestBg(posts: PostData[], date: string) {
  const taken = new Set(
    [mainOf(posts, addDays(date, -1)), mainOf(posts, addDays(date, 1))].map((p) => p?.background)
  );
  const start = (Number(date.slice(8, 10)) + Number(date.slice(5, 7))) % ROTATION.length;
  for (let i = 0; i < ROTATION.length; i++) {
    const bg = ROTATION[(start + i) % ROTATION.length];
    if (!taken.has(bg)) return bg;
  }
  return ROTATION[start];
}

function neighborBgs(posts: PostData[], date: string, selfId?: number) {
  return [addDays(date, -1), addDays(date, 1)]
    .map((d) => posts.find((p) => p.date === d && !p.extra && p.status !== "cancelado" && p.id !== selfId)?.background)
    .filter((b): b is string => !!b);
}

export function SocialCalendar({
  posts,
  lines,
  monthRef,
  today,
  conflicts,
  grid,
  aiEnabled,
}: {
  posts: PostData[];
  lines: LineData[];
  monthRef: string;
  today: string;
  conflicts: string[];
  grid: Record<string, { linha: string; peca: string }>;
  aiEnabled: boolean;
}) {
  const [open, setOpen] = useState<{ id: number | null; date: string } | null>(null);
  const lineOf = (slug: string | null) => lines.find((l) => l.slug === slug);
  const current = open?.id ? posts.find((p) => p.id === open.id) ?? null : null;

  const [year, month] = monthRef.split("-").map(Number);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const total = daysInMonth(monthRef);
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: total }, (_, i) => `${monthRef}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const next7 = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const next14 = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  return (
    <div className="flex flex-col gap-6">
      {/* próximos 7 dias */}
      <section>
        <SectionTitle note="O que sai nesta semana">Próximos 7 dias</SectionTitle>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
          {next7.map((d) => {
            const dayPosts = posts.filter((p) => p.date === d && p.status !== "cancelado");
            const wd = weekdayOf(d);
            const plan = grid[String(wd)];
            return (
              <div
                key={d}
                className={cn(
                  "flex min-h-28 flex-col gap-1.5 rounded-lg border bg-paper p-2",
                  d === today ? "border-navy" : "border-border"
                )}
              >
                <p className="text-[11px] font-medium text-ink-muted">
                  {WEEKDAYS_SHORT[wd]} {d.slice(8, 10)}/{d.slice(5, 7)}
                </p>
                {dayPosts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setOpen({ id: p.id, date: p.date })}
                    className="flex cursor-pointer flex-col gap-1 rounded-md border border-border p-1.5 text-left hover:bg-black/[0.03]"
                  >
                    <span className="flex items-center gap-1.5">
                      <LineDot line={lineOf(p.lineSlug)} />
                      <BgSwatch value={p.background} />
                      {p.extra && <span className="text-[10px] text-ink-faint">extra</span>}
                    </span>
                    <span className="line-clamp-2 text-[12px] font-medium leading-snug">{p.title}</span>
                    <PostStatusBadge status={p.status} className="self-start" />
                  </button>
                ))}
                {dayPosts.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setOpen({ id: null, date: d })}
                    className="flex flex-1 cursor-pointer flex-col items-start justify-center gap-1 rounded-md border border-dashed border-border-strong p-1.5 text-left text-[11.5px] text-ink-muted hover:bg-black/[0.03]"
                  >
                    <span className="flex items-center gap-1 font-medium text-ink">
                      <Plus className="h-3 w-3" /> Sem post
                    </span>
                    {plan && <span className="line-clamp-2">{plan.peca}</span>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* faixa de fundos */}
      <section>
        <SectionTitle
          note={
            conflicts.length ? (
              <span className="flex items-center gap-1 font-medium text-coral">
                <AlertTriangle className="h-3.5 w-3.5" /> {conflicts.length} repetição de fundo
              </span>
            ) : (
              "Nenhum fundo repetido em sequência"
            )
          }
        >
          Rotação de fundos · 14 dias
        </SectionTitle>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {next14.map((d) => {
            const p = mainOf(posts, d);
            const bg = background(p?.background);
            const clash = conflicts.includes(d);
            return (
              <div key={d} className="flex w-11 shrink-0 flex-col items-center gap-1">
                <span
                  title={bg ? `${d.slice(8, 10)}/${d.slice(5, 7)}: fundo ${bg.label.toLowerCase()}` : "Sem post"}
                  className={cn(
                    "h-8 w-8 rounded-md border",
                    bg ? "border-border-strong" : "border-dashed border-border-strong",
                    clash && "ring-2 ring-coral ring-offset-1"
                  )}
                  style={bg ? { backgroundColor: bg.hex } : undefined}
                />
                <span className="text-[10.5px] tabular-nums text-ink-muted">{d.slice(8, 10)}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* mês */}
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[14px] font-semibold tracking-tight">Calendário do mês</h2>
          <div className="flex items-center gap-2">
            <Link
              href={`/social?aba=calendario&mes=${shiftMonth(monthRef, -1)}`}
              className="rounded-lg border border-border bg-paper p-1.5 hover:bg-black/[0.04]"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <span className="min-w-32 text-center text-[13px] font-semibold">{monthLabel(monthRef)}</span>
            <Link
              href={`/social?aba=calendario&mes=${shiftMonth(monthRef, 1)}`}
              className="rounded-lg border border-border bg-paper p-1.5 hover:bg-black/[0.04]"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Button size="sm" onClick={() => setOpen({ id: null, date: today.startsWith(monthRef) ? today : `${monthRef}-01` })}>
              <Plus className="h-3.5 w-3.5" /> Novo post
            </Button>
          </div>
        </div>
        <Card>
          <CardContent className="p-2 md:p-3">
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS_SHORT.map((d) => (
                <div key={d} className="px-1 py-1.5 text-center text-[11px] font-medium text-ink-faint">
                  {d}
                </div>
              ))}
              {cells.map((date, i) => {
                const dayPosts = date ? posts.filter((p) => p.date === date) : [];
                const isToday = date === today;
                return (
                  <div
                    key={i}
                    className={cn(
                      "group relative min-h-24 rounded-lg border border-transparent p-1 md:min-h-28",
                      date && "border-border/60 bg-paper",
                      isToday && "border-navy"
                    )}
                  >
                    {date && (
                      <>
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "text-[11px] font-medium tabular-nums",
                              isToday
                                ? "flex h-5 w-5 items-center justify-center rounded-full bg-navy text-white"
                                : "text-ink-muted"
                            )}
                          >
                            {Number(date.slice(8, 10))}
                          </span>
                          <button
                            type="button"
                            onClick={() => setOpen({ id: null, date })}
                            className="rounded p-0.5 text-ink-faint opacity-0 hover:bg-black/[0.05] hover:text-ink focus:opacity-100 group-hover:opacity-100"
                            aria-label={`Novo post em ${date.slice(8, 10)}/${date.slice(5, 7)}`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-1 flex flex-col gap-1">
                          {dayPosts.map((p) => {
                            const line = lineOf(p.lineSlug);
                            const done = p.status === "agendado" || p.status === "publicado";
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setOpen({ id: p.id, date: p.date })}
                                title={`${p.title} · ${line?.name ?? "sem linha"}`}
                                className={cn(
                                  "flex cursor-pointer items-start gap-1 rounded border-l-[3px] bg-black/[0.035] px-1 py-0.5 text-left text-[10.5px] leading-tight hover:bg-black/[0.07]",
                                  p.status === "aguardando_ok" && "bg-attention-bg",
                                  p.status === "cancelado" && "opacity-40 line-through"
                                )}
                                style={{ borderLeftColor: line?.color ?? "#cdc6b8" }}
                              >
                                <BgSwatch value={p.background} className="mt-[1px]" />
                                <span className="line-clamp-2 flex-1 font-medium text-ink">{p.title}</span>
                                {done && <Check className="mt-[1px] h-3 w-3 shrink-0 text-money" aria-label="Agendado" />}
                              </button>
                            );
                          })}
                          {conflicts.includes(date) && (
                            <span className="flex items-center gap-1 px-1 text-[10px] font-medium text-coral">
                              <AlertTriangle className="h-3 w-3" /> fundo repetido
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-muted">
          {lines
            .filter((l) => l.active)
            .map((l) => (
              <span key={l.slug} className="flex items-center gap-1.5">
                <LineDot line={l} /> {l.name}
              </span>
            ))}
          <span className="flex items-center gap-1.5">
            <Check className="h-3 w-3 text-money" /> agendado ou publicado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-attention-bg ring-1 ring-coral/40" /> espera o seu OK
          </span>
        </div>
      </section>

      {open && (
        <PostDialog
          key={`${open.id ?? "novo"}-${open.date}`}
          post={current}
          date={open.date}
          suggestedBg={suggestBg(posts, open.date)}
          neighborBgs={neighborBgs(posts, current?.date ?? open.date, current?.id)}
          lines={lines}
          aiEnabled={aiEnabled}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
