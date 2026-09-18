import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { pipelineDeals } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { brl, dateShort } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FunilPage() {
  const deals = await db
    .select()
    .from(pipelineDeals)
    .orderBy(asc(pipelineDeals.stageOrder));

  const open = deals.filter((d) => d.status === "open");
  const total = open.reduce((s, d) => s + parseFloat(d.value ?? "0"), 0);
  const inProposal = open.filter((d) =>
    (d.stageName ?? "").toLowerCase().includes("proposta")
  );
  const inNegotiation = open.filter((d) =>
    (d.stageName ?? "").toLowerCase().includes("negocia")
  );

  const stages = [...new Set(open.map((d) => d.stageName ?? "Sem etapa"))];

  const tiles = [
    { label: "Pipeline total", value: brl(total) },
    { label: "Negócios abertos", value: open.length },
    { label: "Em proposta", value: inProposal.length },
    { label: "Em negociação", value: inNegotiation.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Funil de Vendas · SOBE
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Espelho de leitura do Pipedrive — o pipeline continua sendo gerenciado
          lá.
        </p>
      </header>

      {deals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 p-8">
            <Badge tone="primary">Fase 2</Badge>
            <h2 className="text-lg font-semibold">
              Integração com o Pipedrive
            </h2>
            <p className="max-w-xl text-sm text-muted-foreground">
              Esta área mostrará o Kanban do funil comercial da SOBE (Novo lead
              → Contato → Qualificação → Reunião → Proposta → Negociação →
              Ganho/Perdido) com resumo de pipeline, filtros e atividades — tudo
              lido do Pipedrive via API e armazenado localmente. A estrutura de
              dados já está pronta; falta apenas configurar o token e ativar a
              sincronização.
            </p>
            <Link
              href="/integracoes"
              className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
            >
              Configurar integração <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {tiles.map((t) => (
              <Card key={t.label}>
                <CardContent className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {t.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2">
            {stages.map((stage) => {
              const stageDeals = open.filter(
                (d) => (d.stageName ?? "Sem etapa") === stage
              );
              return (
                <div
                  key={stage}
                  className="flex w-72 shrink-0 flex-col gap-2.5 rounded-xl border border-border bg-muted/50 p-3"
                >
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      {stage}
                    </span>
                    <Badge tone="outline">{stageDeals.length}</Badge>
                  </div>
                  {stageDeals.map((d) => (
                    <div
                      key={d.id}
                      className="rounded-lg border border-border bg-card p-3 shadow-sm"
                    >
                      <p className="text-sm font-medium">{d.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {d.orgName} · {d.personName}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <strong className="tabular-nums">
                          {brl(parseFloat(d.value ?? "0"))}
                        </strong>
                        {d.expectedCloseDate && (
                          <span className="text-muted-foreground">
                            prev. {dateShort(d.expectedCloseDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
