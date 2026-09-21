"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { getDealActivitiesAction } from "@/lib/actions/pipedrive";
import type { ActivityRowData } from "@/lib/activities";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ActivityFormDialog, CrmActivityList, NoteFormDialog } from "@/components/crm-activities";
import { cn } from "@/lib/utils";

export interface DealDetailData {
  id: number;
  pipedriveId: number | null;
  title: string;
  orgName: string | null;
  personName: string | null;
  stageName: string | null;
  ownerName: string | null;
  pipedriveUrl: string | null;
}

/**
 * Card do funil clicável: abre o negócio com as atividades (concluir),
 * nova atividade e registro de nota — tudo gravado direto no Pipedrive.
 */
export function DealDetail({
  deal,
  className,
  children,
}: {
  deal: DealDetailData;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [acts, setActs] = useState<ActivityRowData[] | null>(null);

  const load = useCallback(() => {
    getDealActivitiesAction(deal.id)
      .then(setActs)
      .catch(() => setActs([]));
  }, [deal.id]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const target = {
    dealPipedriveId: deal.pipedriveId,
    label: `"${deal.title}"`,
  };
  const openActs = acts?.filter((a) => !a.done) ?? [];
  const doneActs = acts?.filter((a) => a.done) ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral",
            className
          )}
        >
          {children}
        </button>
      </DialogTrigger>
      <DialogContent title={deal.title} className="max-w-xl">
        <p className="-mt-3 mb-4 text-[12.5px] text-ink-muted">
          {[deal.orgName, deal.personName, deal.stageName, deal.ownerName]
            .filter(Boolean)
            .join(", ")}
        </p>

        {deal.pipedriveId ? (
          <div className="mb-5 flex flex-wrap gap-2">
            <ActivityFormDialog target={target} onDone={load} />
            <NoteFormDialog target={target} />
            {deal.pipedriveUrl && (
              <a
                href={deal.pipedriveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2 text-[12.5px] text-ink-muted hover:text-coral"
              >
                Abrir no Pipedrive <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        ) : null}

        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold">Em aberto</h3>
            {acts === null ? (
              <p className="text-[13px] text-ink-muted">Carregando…</p>
            ) : openActs.length === 0 ? (
              <p className="text-[13px] text-ink-muted">
                Nenhuma atividade aberta. Este negócio está sem próximo passo.
              </p>
            ) : (
              <CrmActivityList activities={openActs} showDeal={false} />
            )}
          </section>
          {doneActs.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-[13px] font-semibold text-ink-muted">Concluídas</h3>
              <CrmActivityList activities={doneActs.slice(0, 8)} showDeal={false} />
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
