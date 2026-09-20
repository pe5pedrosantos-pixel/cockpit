import Link from "next/link";
import { ArrowRight, Building2, CalendarClock, User } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { integrations, pipelineDeals } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DealFormDialog, type StageOption } from "@/components/deal-form";
import { FunilFilters } from "@/components/funil-filters";
import { SyncButton } from "@/components/sync-button";
import { isPipedriveConfigured } from "@/lib/pipedrive/client";
import { brl, dateShort, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function sameDay(a: Date, iso: string) {
  return a.toISOString().slice(0, 10) === iso;
}

export default async function FunilPage({
  searchParams,
}: {
  searchParams: Promise<{
    etapa?: string;
    responsavel?: string;
    empresa?: string;
    status?: string;
    valorMin?: string;
    ate?: string;
  }>;
}) {
  const filters = await searchParams;
  const configured = isPipedriveConfigured();

  const [allDeals, [integration]] = await Promise.all([
    db.select().from(pipelineDeals).orderBy(asc(pipelineDeals.stageOrder)),
    db.select().from(integrations).where(eq(integrations.provider, "pipedrive")),
  ]);

  const lastSyncAt = integration?.lastSyncAt ?? null;
  const syncError =
    integration?.status === "error"
      ? ((integration.meta as { lastError?: string } | null)?.lastError ?? null)
      : null;

  // etapas disponíveis para o formulário de novo negócio
  const stageOptions: StageOption[] = [
    ...new Map(
      allDeals
        .filter((d) => d.stageId)
        .map((d) => [
          d.stageId as number,
          {
            id: d.stageId as number,
            name: d.stageName ?? "Etapa",
            pipelineId: d.pipelineId,
            pipelineName: d.pipelineName,
            order: d.stageOrder ?? 999,
          },
        ])
    ).values(),
  ]
    .sort((a, b) => a.order - b.order)
    .map(({ id, name, pipelineId, pipelineName }) => ({
      id,
      name,
      pipelineId,
      pipelineName,
    }));

  // ── vazio: integração ainda não trouxe dados ────────────────────────────
  if (allDeals.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Funil da SOBE
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Espelho de leitura do Pipedrive — o pipeline continua sendo
              gerenciado lá.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {configured && <DealFormDialog stages={[]} />}
            <SyncButton
              lastSyncAt={lastSyncAt?.toISOString() ?? null}
              configured={configured}
            />
          </div>
        </header>

        <Card>
          <CardContent className="flex flex-col items-start gap-3 p-8">
            <Badge tone={configured ? "warning" : "primary"}>
              {configured ? "Sem dados" : "Não conectado"}
            </Badge>
            <h2 className="text-lg font-semibold">
              {configured
                ? "Nenhum negócio sincronizado ainda"
                : "Integração com o Pipedrive não configurada"}
            </h2>
            <p className="max-w-xl text-sm text-ink-muted">
              {configured
                ? "Clique em “Sincronizar agora” para trazer os negócios, etapas e atividades do Pipedrive."
                : "Adicione PIPEDRIVE_API_TOKEN e PIPEDRIVE_COMPANY_DOMAIN nas variáveis de ambiente para ativar o funil."}
            </p>
            {syncError && (
              <p className="rounded-lg bg-attention-bg px-3 py-2 text-sm text-coral">
                {syncError}
              </p>
            )}
            <Link
              href="/integracoes"
              className="inline-flex items-center gap-1 text-sm font-medium text-coral hover:underline"
            >
              Ir para Integrações <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── filtros ─────────────────────────────────────────────────────────────
  const statusFilter = filters.status ?? "open";
  const minValue = filters.valorMin ? parseFloat(filters.valorMin) : null;

  const deals = allDeals.filter((d) => {
    if (statusFilter !== "all" && (d.status ?? "open") !== statusFilter)
      return false;
    if (filters.etapa && d.stageName !== filters.etapa) return false;
    if (filters.responsavel && d.ownerName !== filters.responsavel) return false;
    if (filters.empresa && d.orgName !== filters.empresa) return false;
    if (minValue !== null && parseFloat(d.value ?? "0") < minValue) return false;
    if (filters.ate) {
      if (!d.expectedCloseDate || d.expectedCloseDate > filters.ate) return false;
    }
    return true;
  });

  const today = todayISO();
  const total = deals.reduce((s, d) => s + parseFloat(d.value ?? "0"), 0);
  const open = deals.filter((d) => (d.status ?? "open") === "open");
  const inProposal = deals.filter((d) =>
    (d.stageName ?? "").toLowerCase().includes("proposta")
  );
  const inNegotiation = deals.filter((d) =>
    (d.stageName ?? "").toLowerCase().includes("negocia")
  );
  const overdueActivities = deals.filter(
    (d) => d.nextActivityAt && d.nextActivityAt.toISOString().slice(0, 10) < today
  );
  const noNextActivity = open.filter((d) => !d.nextActivityAt);

  const tiles = [
    { label: "Pipeline total", value: brl(total) },
    { label: "Negócios", value: deals.length },
    { label: "Em proposta", value: inProposal.length },
    { label: "Em negociação", value: inNegotiation.length },
    { label: "Ativ. atrasadas", value: overdueActivities.length },
    { label: "Sem follow-up", value: noNextActivity.length },
  ];

  // colunas na ordem das etapas do Pipedrive
  const stageOrder = new Map<string, number>();
  for (const d of allDeals) {
    const name = d.stageName ?? "Sem etapa";
    const order = d.stageOrder ?? 999;
    if (!stageOrder.has(name) || order < stageOrder.get(name)!) {
      stageOrder.set(name, order);
    }
  }
  const stages = [...stageOrder.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name);

  const owners = [
    ...new Set(allDeals.map((d) => d.ownerName).filter(Boolean)),
  ].sort() as string[];
  const companies = [
    ...new Set(allDeals.map((d) => d.orgName).filter(Boolean)),
  ].sort() as string[];

  const visibleStages = filters.etapa ? [filters.etapa] : stages;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Funil da SOBE
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {lastSyncAt
              ? `Sincronizado do Pipedrive em ${lastSyncAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}`
              : "Espelho de leitura do Pipedrive"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DealFormDialog stages={stageOptions} />
          <SyncButton
            lastSyncAt={lastSyncAt?.toISOString() ?? null}
            configured={configured}
            auto
          />
        </div>
      </header>

      {syncError && (
        <p className="rounded-lg bg-attention-bg px-3 py-2 text-sm text-coral">
          Última sincronização falhou: {syncError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardContent className="p-3.5">
              <p className="text-[12px] text-ink-muted">
                {t.label}
              </p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums">
                {t.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <FunilFilters
        stages={stages}
        owners={owners}
        companies={companies}
        current={filters}
      />

      {deals.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-ink-muted">
            Nenhum negócio corresponde a esses filtros.
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-3">
          {visibleStages.map((stage) => {
            const stageDeals = deals.filter(
              (d) => (d.stageName ?? "Sem etapa") === stage
            );
            const stageTotal = stageDeals.reduce(
              (s, d) => s + parseFloat(d.value ?? "0"),
              0
            );
            return (
              <div
                key={stage}
                className="flex w-[19rem] shrink-0 flex-col gap-2.5 rounded-xl border border-border bg-black/[0.025] p-3"
              >
                <div className="flex items-baseline justify-between px-1">
                  <span className="truncate text-[12.5px] font-semibold text-ink">
                    {stage}
                  </span>
                  <Badge tone="outline">{stageDeals.length}</Badge>
                </div>
                <p className="-mt-1.5 px-1 text-[11px] tabular-nums text-ink-muted">
                  {brl(stageTotal)}
                </p>

                {stageDeals.map((d) => {
                  const nextISO = d.nextActivityAt
                    ?.toISOString()
                    .slice(0, 10);
                  const overdue = nextISO && nextISO < today;
                  const dueToday = d.nextActivityAt
                    ? sameDay(d.nextActivityAt, today)
                    : false;
                  return (
                    <div
                      key={d.id}
                      className={cn(
                        "rounded-lg border border-border bg-paper p-3 shadow-sm transition-shadow hover:shadow-md",
                        overdue && "border-coral/30"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">
                          {d.title}
                        </p>
                        {d.status === "won" && (
                          <Badge tone="success">Ganho</Badge>
                        )}
                        {d.status === "lost" && (
                          <Badge tone="danger">Perdido</Badge>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-col gap-0.5 text-[11px] text-ink-muted">
                        {d.orgName && (
                          <span className="flex items-center gap-1.5">
                            <Building2 className="h-3 w-3 shrink-0" />
                            <span className="truncate">{d.orgName}</span>
                          </span>
                        )}
                        {d.personName && (
                          <span className="flex items-center gap-1.5">
                            <User className="h-3 w-3 shrink-0" />
                            <span className="truncate">{d.personName}</span>
                          </span>
                        )}
                        {d.expectedCloseDate && (
                          <span className="flex items-center gap-1.5">
                            <CalendarClock className="h-3 w-3 shrink-0" />
                            previsão {dateShort(d.expectedCloseDate)}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                        <strong className="text-sm tabular-nums">
                          {brl(parseFloat(d.value ?? "0"))}
                        </strong>
                        {d.ownerName && (
                          <span className="truncate text-[11px] text-ink-muted">
                            {d.ownerName}
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 text-[11px]">
                        {d.nextActivityAt ? (
                          <span
                            className={cn(
                              "flex items-start gap-1",
                              overdue
                                ? "font-medium text-coral"
                                : dueToday
                                  ? "font-medium text-coral"
                                  : "text-ink-muted"
                            )}
                          >
                            {overdue ? "🔴" : dueToday ? "🟡" : "→"}
                            <span className="truncate">
                              {d.nextActivitySubject ?? "Próxima atividade"} ·{" "}
                              {dateShort(d.nextActivityAt.toISOString())}
                            </span>
                          </span>
                        ) : (
                          (d.status ?? "open") === "open" && (
                            <span className="text-coral">
                              Sem próximo passo
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}

                {stageDeals.length === 0 && (
                  <p className="px-1 py-4 text-center text-xs text-ink-muted">
                    Nenhum negócio.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
