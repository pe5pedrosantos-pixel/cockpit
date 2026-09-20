"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createDealAction } from "@/lib/actions/pipedrive";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { todayISO } from "@/lib/format";

export interface StageOption {
  id: number;
  name: string;
  pipelineId: number | null;
  pipelineName: string | null;
}

export function DealFormDialog({ stages }: { stages: StageOption[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    const stageId = String(formData.get("stageId") ?? "");
    const stage = stages.find((s) => String(s.id) === stageId);
    if (stage?.pipelineId) formData.set("pipelineId", String(stage.pipelineId));

    startTransition(async () => {
      const result = await createDealAction(formData);
      if (result.ok) setOpen(false);
      else setError(result.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Novo negócio
        </Button>
      </DialogTrigger>
      <DialogContent title="Novo negócio no Pipedrive">
        <form action={onSubmit} className="flex flex-col gap-4">
          <p className="-mt-1 rounded-lg bg-black/[0.03] px-3 py-2 text-xs text-ink-muted">
            O negócio é criado direto no Pipedrive e sincronizado aqui em
            seguida — o CRM continua sendo a fonte única de verdade.
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-title">Título do negócio</Label>
            <Input
              id="d-title"
              name="title"
              required
              placeholder="Ex.: Pacote de comunicação — NORR Energia"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="d-org">Empresa</Label>
              <Input
                id="d-org"
                name="orgName"
                placeholder="Ex.: NORR ENERGIA"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="d-person">Contato</Label>
              <Input id="d-person" name="personName" placeholder="Ex.: Renan" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="d-value">Valor (R$)</Label>
              <Input
                id="d-value"
                name="value"
                type="number"
                min={0}
                step={100}
                placeholder="0"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="d-date">Previsão de fechamento</Label>
              <Input
                id="d-date"
                name="expectedCloseDate"
                type="date"
                defaultValue={todayISO()}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-stage">Etapa</Label>
            <Select id="d-stage" name="stageId" defaultValue="">
              <option value="">Primeira etapa do funil</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.pipelineName ? ` · ${s.pipelineName}` : ""}
                </option>
              ))}
            </Select>
          </div>

          {error && (
            <p className="rounded-lg bg-attention-bg px-3 py-2 text-sm text-coral">
              {error}
            </p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? "Criando no Pipedrive…" : "Criar negócio"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
