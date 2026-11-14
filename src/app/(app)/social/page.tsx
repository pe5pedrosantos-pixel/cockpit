import Link from "next/link";
import { headers } from "next/headers";
import { desc, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { smAnalyses, smIdeas, smMetrics, smRuns } from "@/lib/db/schema";
import {
  getSettings,
  isSocialReady,
  listLines,
  listMedia,
  listPosts,
  listRequests,
  rotationConflicts,
} from "@/lib/social/service";
import { aiModel, isAiConfigured } from "@/lib/social/ai";
import { isStorageConfigured } from "@/lib/social/storage";
import { addDays } from "@/lib/social/constants";
import { currentMonthRef, daysInMonth, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SocialCalendar } from "@/components/social/social-calendar";
import { ApprovalQueue } from "@/components/social/approval-queue";
import { NewRequestDialog, RequestsBoard } from "@/components/social/requests-board";
import { LinesPanel } from "@/components/social/lines-panel";
import { AnalyticsPanel } from "@/components/social/analytics-panel";
import { ConnectionsPanel, HistoryPanel, SetupCard } from "@/components/social/settings-panels";
import type { MediaData, PostData, RequestData } from "@/components/social/types";
import type { SmMedia, SmPost } from "@/lib/db/schema";

export const dynamic = "force-dynamic";
/** as ações com o Claude (API da Anthropic) podem levar até ~50 s */
export const maxDuration = 60;

const TABS = [
  { key: "calendario", label: "Calendário" },
  { key: "fila", label: "Fila de aprovação" },
  { key: "solicitacoes", label: "Solicitações" },
  { key: "linhas", label: "Linhas editoriais" },
  { key: "analytics", label: "Analytics" },
  { key: "historico", label: "Histórico" },
  { key: "conexoes", label: "Conexões" },
] as const;

type Tab = (typeof TABS)[number]["key"];

function toMedia(m: SmMedia): MediaData {
  return {
    id: m.id,
    kind: m.kind,
    url: m.url,
    name: m.name,
    contentType: m.contentType,
    size: m.size,
    position: m.position,
    source: m.source,
  };
}

function toPost(p: SmPost, media: Map<number, MediaData[]>): PostData {
  return {
    id: p.id,
    date: p.date,
    extra: p.extra,
    lineSlug: p.lineSlug,
    title: p.title,
    format: p.format,
    background: p.background,
    status: p.status,
    networks: p.networks,
    timeLinkedin: p.timeLinkedin,
    timeInstagram: p.timeInstagram,
    captionLinkedin: p.captionLinkedin,
    captionInstagram: p.captionInstagram,
    firstCommentLinkedin: p.firstCommentLinkedin,
    firstCommentInstagram: p.firstCommentInstagram,
    artUrl: p.artUrl,
    previewUrl: p.previewUrl,
    sourceName: p.sourceName,
    sourceUrl: p.sourceUrl,
    notes: p.notes,
    pending: p.pending,
    adjustRequest: p.adjustRequest,
    approvedAt: p.approvedAt?.toISOString() ?? null,
    metricoolIdLinkedin: p.metricoolIdLinkedin,
    metricoolIdInstagram: p.metricoolIdInstagram,
    urlLinkedin: p.urlLinkedin,
    urlInstagram: p.urlInstagram,
    updatedBy: p.updatedBy,
    updatedAt: p.updatedAt.toISOString(),
    media: media.get(p.id) ?? [],
  };
}

const num = (v: string | null) => (v == null ? null : Number(v));

export default async function SocialPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; mes?: string }>;
}) {
  const { aba, mes } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === aba) ? (aba as Tab) : "calendario";
  const monthRef = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : currentMonthRef();
  const today = todayISO();

  const header = (action?: React.ReactNode) => (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-[24px] font-extrabold tracking-[-0.025em]">Social Media</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Marca Pedro Santos no Instagram e no LinkedIn. Você planeja e aprova aqui; o Claude produz, agenda e mede.
        </p>
      </div>
      {action}
    </header>
  );

  if (!(await isSocialReady())) {
    return (
      <div className="flex flex-col gap-6">
        {header()}
        <SetupCard />
      </div>
    );
  }

  const monthStart = `${monthRef}-01`;
  const monthEnd = `${monthRef}-${String(daysInMonth(monthRef)).padStart(2, "0")}`;
  const from = [monthStart, addDays(today, -31)].sort()[0];
  const to = [monthEnd, addDays(today, 31)].sort()[1];

  const [posts, queue, requests, lines, ideas, metrics, analyses, runs, settings] = await Promise.all([
    listPosts({ from, to }),
    listPosts({ status: ["aguardando_ok", "ajuste"] }),
    listRequests({ limit: 300 }),
    listLines(),
    db.select().from(smIdeas).where(inArray(smIdeas.status, ["nova", "aprovada"])).orderBy(desc(smIdeas.createdAt)).limit(200),
    db
      .select()
      .from(smMetrics)
      .where(gte(smMetrics.publishedAt, new Date(Date.now() - 120 * 86_400_000)))
      .orderBy(desc(smMetrics.publishedAt))
      .limit(600),
    db.select().from(smAnalyses).orderBy(desc(smAnalyses.createdAt)).limit(6),
    db.select().from(smRuns).orderBy(desc(smRuns.ranAt)).limit(40),
    getSettings(),
  ]);

  const mediaRows = await listMedia([...new Set([...posts, ...queue].map((p) => p.id))]);
  const mediaByPost = new Map<number, MediaData[]>();
  for (const m of mediaRows) {
    const list = mediaByPost.get(m.postId) ?? [];
    list.push(toMedia(m));
    mediaByPost.set(m.postId, list);
  }
  const toPostData = (p: SmPost) => toPost(p, mediaByPost);
  const postData = posts.map(toPostData);
  const postById = new Map([...posts, ...queue].map((p) => [p.id, p]));
  const requestData: RequestData[] = requests.map((r) => ({
    id: r.id,
    direction: r.direction,
    target: r.target,
    kind: r.kind,
    title: r.title,
    details: r.details,
    postId: r.postId,
    postTitle: r.postId ? postById.get(r.postId)?.title ?? null : null,
    postDate: r.postId ? postById.get(r.postId)?.date ?? null : null,
    status: r.status,
    priority: r.priority,
    dueDate: r.dueDate,
    result: r.result,
    resultUrl: r.resultUrl,
    log: r.log ?? [],
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
  }));

  const openReq = requests.filter((r) => r.status === "aberta" || r.status === "em_andamento");
  const forPedro = openReq.filter((r) => r.direction === "para_pedro").length;
  const forClaude = openReq.filter((r) => r.direction === "para_claude").length;
  const waiting = queue.filter((p) => p.status === "aguardando_ok");

  const lineData = lines.map((l) => ({
    id: l.id,
    slug: l.slug,
    name: l.name,
    color: l.color,
    position: l.position,
    active: l.active,
    frequency: l.frequency,
    objective: l.objective,
    scope: l.scope,
    formats: l.formats ?? [],
  }));

  const counts: Record<string, { month: number; next30: number }> = {};
  for (const p of posts) {
    if (!p.lineSlug || p.status === "cancelado") continue;
    const c = (counts[p.lineSlug] ??= { month: 0, next30: 0 });
    if (p.date.startsWith(monthRef)) c.month++;
    if (p.date >= today && p.date <= addDays(today, 30)) c.next30++;
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const secret = process.env.MCP_SECRET ?? "";
  const mcpUrl = secret.length >= 24 ? `${proto}://${host}/api/mcp/${secret}` : null;
  const aiEnabled = isAiConfigured();
  const storageEnabled = isStorageConfigured();

  const lastSync = metrics.reduce<Date | null>((max, m) => (!max || m.syncedAt > max ? m.syncedAt : max), null);

  const badge = (key: Tab) => {
    if (key === "fila" && waiting.length) return { n: waiting.length, attention: true };
    if (key === "solicitacoes" && (forPedro || forClaude)) return { n: forPedro || forClaude, attention: forPedro > 0 };
    return null;
  };

  return (
    <div className="flex flex-col gap-6">
      {header(
        tab !== "solicitacoes" ? (
          <NewRequestDialog posts={postData.filter((p) => p.date >= today)} label="Pedir ao Claude" />
        ) : undefined
      )}

      <nav className="-mx-1 flex gap-5 overflow-x-auto border-b border-border px-1" aria-label="Seções da social media">
        {TABS.map((t) => {
          const b = badge(t.key);
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              prefetch={false}
              href={`/social?aba=${t.key}${t.key === "calendario" && mes ? `&mes=${monthRef}` : ""}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 pb-2 text-[13.5px] transition-colors",
                active ? "border-coral font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink"
              )}
            >
              {t.label}
              {b && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10.5px] font-semibold tabular-nums",
                    b.attention ? "bg-coral text-white" : "bg-black/[0.07] text-ink-muted"
                  )}
                >
                  {b.n}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {tab === "calendario" && (
        <SocialCalendar
          posts={postData}
          lines={lineData}
          monthRef={monthRef}
          today={today}
          conflicts={rotationConflicts(posts)}
          grid={settings.grade}
          aiEnabled={aiEnabled}
          storageEnabled={storageEnabled}
        />
      )}

      {tab === "fila" && (
        <ApprovalQueue
          waiting={waiting.map(toPostData)}
          adjusting={queue.filter((p) => p.status === "ajuste").map(toPostData)}
          lines={lineData}
          aiEnabled={aiEnabled}
          storageEnabled={storageEnabled}
        />
      )}

      {tab === "solicitacoes" && (
        <RequestsBoard
          requests={requestData}
          posts={postData.filter((p) => p.date >= addDays(today, -7) && p.status !== "cancelado")}
          aiEnabled={aiEnabled}
        />
      )}

      {tab === "linhas" && (
        <LinesPanel
          lines={lineData}
          ideas={ideas.map((i) => ({
            id: i.id,
            lineSlug: i.lineSlug,
            title: i.title,
            hook: i.hook,
            format: i.format,
            details: i.details,
            status: i.status,
            source: i.source,
            createdAt: i.createdAt.toISOString(),
          }))}
          counts={counts}
          aiEnabled={aiEnabled}
          today={today}
        />
      )}

      {tab === "analytics" && (
        <AnalyticsPanel
          metrics={metrics.map((m) => ({
            id: m.id,
            network: m.network,
            url: m.url,
            kind: m.kind,
            publishedAt: m.publishedAt?.toISOString() ?? null,
            text: m.text,
            likes: m.likes,
            comments: m.comments,
            saves: m.saves,
            shares: m.shares,
            reach: m.reach,
            impressions: m.impressions,
            clicks: m.clicks,
            videoViews: m.videoViews,
            follows: m.follows,
            avgWatchSeconds: num(m.avgWatchSeconds),
            totalWatchSeconds: num(m.totalWatchSeconds),
            viewRate: num(m.viewRate),
            postId: m.postId,
          }))}
          analyses={analyses.map((a) => ({
            id: a.id,
            period: a.period,
            summary: a.summary,
            points: a.points ?? [],
            source: a.source,
            createdAt: a.createdAt.toISOString(),
          }))}
          aiEnabled={aiEnabled}
          lastSync={lastSync?.toISOString() ?? null}
          metricsRequestOpen={openReq.some((r) => r.kind === "metricas")}
          now={Date.now()}
        />
      )}

      {tab === "historico" && (
        <HistoryPanel
          runs={runs.map((r) => ({
            id: r.id,
            routine: r.routine,
            result: r.result,
            summary: r.summary,
            details: r.details,
            ranAt: r.ranAt.toISOString(),
          }))}
          done={postData
            .filter((p) => (p.status === "agendado" || p.status === "publicado") && p.date >= addDays(today, -30))
            .sort((a, b) => b.date.localeCompare(a.date))}
        />
      )}

      {tab === "conexoes" && (
        <ConnectionsPanel
          aiConfigured={aiEnabled}
          aiModel={aiModel()}
          mcpUrl={mcpUrl}
          mcpSecretWeak={secret.length > 0 && secret.length < 24}
          storageEnabled={storageEnabled}
          times={settings.horarios}
        />
      )}

    </div>
  );
}
