import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function IntegracoesPage() {
  const [pipedrive] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.provider, "pipedrive"));

  const hasToken = !!process.env.PIPEDRIVE_API_TOKEN;
  const hasDomain = !!process.env.PIPEDRIVE_COMPANY_DOMAIN;
  const connected = pipedrive?.status === "connected";

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
                Funil comercial da SOBE (somente leitura)
              </p>
            </div>
          </div>
          <Badge tone={connected ? "success" : "default"}>
            {connected ? "🟢 Conectado" : "🔴 Não conectado"}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <p className="font-medium">Como conectar (Fase 2)</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>
                No Pipedrive: Configurações pessoais → API → copie seu token.
              </li>
              <li>
                Configure as variáveis de ambiente no projeto (Vercel →
                Settings → Environment Variables):
              </li>
            </ol>
            <pre className="mt-3 overflow-x-auto rounded-md bg-zinc-900 p-3 text-xs text-zinc-100">
              {`PIPEDRIVE_API_TOKEN=seu_token_aqui\nPIPEDRIVE_COMPANY_DOMAIN=sobe`}
            </pre>
            <p className="mt-3 text-xs text-muted-foreground">
              As chaves ficam apenas no servidor — nunca são expostas no
              navegador. A sincronização lê pipelines, etapas, negócios,
              organizações, pessoas e atividades, e grava uma cópia local para
              a plataforma não depender da API em cada tela.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <code className="text-xs">PIPEDRIVE_API_TOKEN</code>
              <Badge tone={hasToken ? "success" : "warning"}>
                {hasToken ? "Definido" : "Não definido"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <code className="text-xs">PIPEDRIVE_COMPANY_DOMAIN</code>
              <Badge tone={hasDomain ? "success" : "warning"}>
                {hasDomain ? "Definido" : "Não definido"}
              </Badge>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {pipedrive?.lastSyncAt
              ? `Última sincronização: ${pipedrive.lastSyncAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
              : "Nenhuma sincronização realizada ainda. O botão “Sincronizar agora” será habilitado na Fase 2, junto com a camada de serviço do Pipedrive."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
