import { headers } from "next/headers";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { Stat } from "@/components/ui/card";
import { ConnectSiteDialog, LeadsBoard, NewLeadDialog } from "@/components/leads-board";
import { OPEN_STAGES } from "@/lib/leads";
import { brl, currentMonthRef, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const rows = await db.select().from(leads).orderBy(desc(leads.createdAt));
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "cockpit-omega-six.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const endpoint = `${proto}://${host}/api/leads`;

  const today = todayISO();
  const month = currentMonthRef();
  const open = rows.filter((l) => OPEN_STAGES.includes(l.stage as never));
  const unseen = rows.filter((l) => !l.seen).length;
  const pipeline = open.reduce((s, l) => s + Number(l.value ?? 0), 0);
  const wonMonth = rows
    .filter((l) => l.stage === "fechado" && l.stageChangedAt.toISOString().slice(0, 7) === month)
    .reduce((s, l) => s + Number(l.value ?? 0), 0);
  const overdue = open.filter((l) => l.nextStepDate && l.nextStepDate < today).length;

  const tiles: { label: string; value: string | number; tone: "default" | "attention" | "money" }[] = [
    { label: "Leads em aberto", value: open.length, tone: "default" },
    { label: "Novos do site", value: unseen, tone: unseen > 0 ? "attention" : "default" },
  ];
  if (pipeline > 0) tiles.push({ label: "Em aberto (R$)", value: brl(pipeline), tone: "default" });
  if (wonMonth > 0) tiles.push({ label: "Fechado no mês", value: brl(wonMonth), tone: "money" });
  tiles.push({
    label: "Próximo passo atrasado",
    value: overdue,
    tone: overdue > 0 ? "attention" : "default",
  });

  const data = rows.map((l) => ({
    id: l.id,
    name: l.name,
    email: l.email,
    phone: l.phone,
    organization: l.organization,
    role: l.role,
    interest: l.interest,
    message: l.message,
    stage: l.stage,
    value: l.value,
    eventDate: l.eventDate,
    nextStep: l.nextStep,
    nextStepDate: l.nextStepDate,
    lostReason: l.lostReason,
    source: l.source,
    utmSource: l.utmSource,
    utmCampaign: l.utmCampaign,
    pageUrl: l.pageUrl,
    seen: l.seen,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-extrabold tracking-[-0.025em]">
            Funil Pedro Santos
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Palestras, consultorias e mentorias. Os contatos do site entram aqui sozinhos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ConnectSiteDialog endpoint={endpoint} />
          <NewLeadDialog />
        </div>
      </header>

      <div className={cn("grid grid-cols-2 gap-3", tiles.length <= 3 ? "md:grid-cols-3" : "md:grid-cols-5")}>
        {tiles.map((t) => (
          <Stat key={t.label} label={t.label} value={t.value} tone={t.tone} />
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-paper p-8 text-center text-[13.5px] text-ink-muted">
          Nenhum lead ainda. Conecte o formulário do site em &ldquo;Conectar site&rdquo; ou
          adicione um contato em &ldquo;Novo lead&rdquo;.
        </div>
      ) : (
        <LeadsBoard leads={data} />
      )}
    </div>
  );
}
