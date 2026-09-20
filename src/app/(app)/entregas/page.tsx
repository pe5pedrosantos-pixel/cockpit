import { Card, CardContent } from "@/components/ui/card";
import { DeliverableFormDialog } from "@/components/deliverable-form";
import { DeliverablesKanban } from "@/components/deliverables-kanban";
import { EntregasFilters } from "@/components/filters";
import { AlertsPanel } from "@/components/alerts-panel";
import { buildAlerts, summarizeCompanyMonth } from "@/lib/alerts";
import { currentMonthRef, monthLabel } from "@/lib/format";
import {
  getActiveCompanies,
  getCategories,
  getCompanyBySlug,
  getDeliverables,
} from "@/lib/queries";
import { toDeliverableCard } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function EntregasPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; mes?: string }>;
}) {
  const { empresa, mes } = await searchParams;
  const monthRef = mes ?? currentMonthRef();

  const [companies, categories] = await Promise.all([
    getActiveCompanies(),
    getCategories(),
  ]);
  const deliverableCompanies = companies.filter((c) => c.hasDeliverables);

  const company = empresa ? await getCompanyBySlug(empresa) : null;
  const items = await getDeliverables(company?.id, monthRef);
  const cards = items.map(toDeliverableCard);

  const planned = cards.reduce((s, d) => s + d.plannedQty, 0);
  const delivered = cards.reduce(
    (s, d) => s + Math.min(d.deliveredQty, d.plannedQty),
    0
  );
  const pending = Math.max(planned - delivered, 0);
  const percent = planned > 0 ? Math.round((delivered / planned) * 100) : 0;

  const scope = company ? [company] : deliverableCompanies;
  const summaries = scope.map((c) =>
    summarizeCompanyMonth(
      c,
      monthRef,
      items.filter((d) => d.companyId === c.id)
    )
  );
  const alerts = buildAlerts(summaries, []);

  const companyOptions = deliverableCompanies.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  const tiles = [
    { label: "Planejadas", value: planned },
    { label: "Concluídas", value: delivered },
    { label: "Pendentes", value: pending },
    { label: "Percentual", value: `${percent}%` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Entregas</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {company ? company.name : "Todas as empresas"} ·{" "}
            {monthLabel(monthRef)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EntregasFilters
            companies={deliverableCompanies}
            selectedCompany={empresa}
            selectedMonth={monthRef}
          />
          <DeliverableFormDialog
            companies={companyOptions}
            categories={categoryOptions}
            defaultMonth={monthRef}
            defaultCompanyId={company?.id}
          />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardContent className="p-4">
              <p className="text-[12.5px] text-ink-muted">
                {t.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {t.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertsPanel
        alerts={alerts.filter((a) => a.level !== "ok")}
        emptyMessage={`Nenhum alerta para ${monthLabel(monthRef)}.`}
      />

      <DeliverablesKanban
        items={cards}
        companies={companyOptions}
        categories={categoryOptions}
        defaultMonth={monthRef}
        showCompany={!company}
      />
    </div>
  );
}
