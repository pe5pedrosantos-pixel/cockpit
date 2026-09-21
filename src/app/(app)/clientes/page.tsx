import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { ClientList } from "@/components/client-list";
import { CrmActivityList } from "@/components/crm-activities";
import { SyncButton } from "@/components/sync-button";
import { isPipedriveConfigured } from "@/lib/pipedrive/client";
import { getClients, getDueActivities } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const configured = isPipedriveConfigured();
  const [clients, due, [integration]] = await Promise.all([
    getClients(),
    getDueActivities(),
    db.select().from(integrations).where(eq(integrations.provider, "pipedrive")),
  ]);
  const lastSyncAt = integration?.lastSyncAt ?? null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-extrabold tracking-[-0.025em]">
            Clientes
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Empresas e contatos do Pipedrive. Atividades e notas criadas aqui vão
            direto para lá.
          </p>
        </div>
        <SyncButton
          lastSyncAt={lastSyncAt?.toISOString() ?? null}
          configured={configured}
          auto
        />
      </header>

      {due.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">
            Para hoje e atrasadas
          </h2>
          <CrmActivityList activities={due} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">
          Empresas
        </h2>
        {clients.length === 0 ? (
          <p className="text-[13.5px] text-ink-muted">
            Nenhuma empresa sincronizada ainda. Clique em sincronizar para trazer
            as organizações e contatos do Pipedrive.
          </p>
        ) : (
          <ClientList clients={clients} />
        )}
      </section>
    </div>
  );
}
