import { CheckCircle2, XCircle } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { activities, integrations, pipelineDeals } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SyncButton } from "@/components/sync-button";
import { isPipedriveConfigured } from "@/lib/pipedrive/client";

export const dynamic = "force-dynamic";

export default async function IntegracoesPage() {
  const [[pipedrive], dealRows, actRows] = await Promise.all([
    db.select().from(integrations).where(eq(integrations.provider, "pipedrive")),
    db.select({ id: pipelineDeals.id }).from(pipelineDeals),
    db.select({ id: activities.id }).from(activities),
  ]);

  const configured = isPipedriveConfigured();
  const hasToken = !!process.env.PIPEDRIVE_API_TOKEN;
  const hasDomain = !!process.env.PIPEDRIVE_COMPANY_DOMAIN;
  const hasCronSecret = !!process.env.CRON_SECRET;
  const status = pipedrive?.status ?? "disconnected";
  const lastError = (pipedrive?.meta as { lastError?: string } | null)
    ?.lastError;
  const connected = status === "connected";

  const envRows = [
    { name: "PIPEDRIVE_API_TOKEN", ok: hasToken, required: true },
    { name: "PIPEDRIVE_COMPANY_DOMAIN", ok: hasDomain, required: true },
    { name: "CRON_SECRET", ok: hasCronSecret, required: false },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Integrações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conexões com sistemas externos
        </p>
      </header>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-sm font-bold text-white">
              Pd
            </span>
            <div>
              <CardTitle className="text-base">Pipedrive</CardTitle>
              <p className="text-xs text-muted-foreground">
                Funil comercial da SOBE · somente leitura
              </p>
            </div>
          </div>
          <Badge
            tone={
              connected ? "success" : status === "error" ? "danger" : "default"
            }
          >
            {connected
              ? "🟢 Conectado"
              : status === "error"
                ? "🔴 Erro"
                : "🔴 Não conectado"}
          </Badge>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-4">
            <div className="text-sm">
              <p className="font-medium">
                {pipedrive?.lastSyncAt
                  ? `Última sincronização: ${pipedrive.lastSyncAt.toLocaleString(
                      "pt-BR",
                      {
                        timeZone: "America/Sao_Paulo",
                        dateStyle: "short",
                        timeStyle: "short",
                      }
                    )}`
                  : "Nenhuma sincronização realizada ainda."}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {dealRows.length} negócios e {actRows.length} atividades no
                banco local.
              </p>
            </div>
            <SyncButton
              lastSyncAt={pipedrive?.lastSyncAt?.toISOString() ?? null}
              configured={configured}
              size="default"
            />
          </div>

          {lastError && status === "error" && (
            <p className="rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 text-sm text-red-800">
              {lastError}
            </p>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Variáveis de ambiente
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {envRows.map((v) => (
                <div
                  key={v.name}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <code className="text-xs">{v.name}</code>
                  {v.ok ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Definido
                    </span>
                  ) : (
                    <span
                      className={`flex items-center gap-1 text-xs font-medium ${v.required ? "text-danger" : "text-muted-foreground"}`}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      {v.required ? "Faltando" : "Opcional"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 text-sm">
            <p className="font-medium">Como funciona</p>
            <p className="mt-2 text-muted-foreground">
              A plataforma lê pipelines, etapas, negócios, organizações,
              pessoas, usuários e atividades da API v2 do Pipedrive e guarda uma
              cópia local — assim nenhuma tela depende da API em tempo real. A
              sincronização roda automaticamente uma vez por dia, quando você
              abre o funil com dados de mais de 30 minutos, e sempre que você
              clica em “Sincronizar agora”. Nada é escrito de volta no
              Pipedrive: o pipeline continua sendo gerenciado lá.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              As chaves ficam apenas no servidor e nunca são expostas ao
              navegador.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
