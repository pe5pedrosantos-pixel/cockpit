"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import {
  createDeliverable,
  updateDeliverable,
} from "@/lib/actions/deliverables";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { monthLabel, monthOptions } from "@/lib/format";

export interface DeliverableFormData {
  id?: number;
  companyId?: number;
  categoryId?: number | null;
  title?: string;
  description?: string | null;
  monthRef?: string;
  plannedQty?: number;
  deliveredQty?: number;
  deadline?: string | null;
  status?: string;
  owner?: string | null;
  notes?: string | null;
}

export function DeliverableFormDialog({
  companies,
  categories,
  initial,
  defaultMonth,
  defaultCompanyId,
  trigger = "button",
}: {
  companies: { id: number; name: string }[];
  categories: { id: number; name: string }[];
  initial?: DeliverableFormData;
  defaultMonth: string;
  defaultCompanyId?: number;
  trigger?: "button" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isEdit = !!initial?.id;

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      if (isEdit) await updateDeliverable(initial!.id!, formData);
      else await createDeliverable(formData);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger === "button" ? (
          <Button size="sm">
            <Plus className="h-4 w-4" /> Nova entrega
          </Button>
        ) : (
          <Button variant="ghost" size="icon" aria-label="Editar">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={isEdit ? "Editar entrega" : "Nova entrega"}>
        <form action={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="companyId">Empresa</Label>
              <Select
                id="companyId"
                name="companyId"
                required
                defaultValue={initial?.companyId ?? defaultCompanyId ?? ""}
              >
                <option value="" disabled>
                  Selecione…
                </option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="monthRef">Mês</Label>
              <Select
                id="monthRef"
                name="monthRef"
                required
                defaultValue={initial?.monthRef ?? defaultMonth}
              >
                {monthOptions().map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Nome da entrega</Label>
            <Input
              id="title"
              name="title"
              required
              placeholder="Ex.: Artes para redes sociais"
              defaultValue={initial?.title ?? ""}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="categoryId">Categoria</Label>
              <Select
                id="categoryId"
                name="categoryId"
                defaultValue={initial?.categoryId ?? ""}
              >
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deadline">Prazo</Label>
              <Input
                id="deadline"
                name="deadline"
                type="date"
                defaultValue={initial?.deadline ?? ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plannedQty">Planejado</Label>
              <Input
                id="plannedQty"
                name="plannedQty"
                type="number"
                min={1}
                required
                defaultValue={initial?.plannedQty ?? 1}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deliveredQty">Entregue</Label>
              <Input
                id="deliveredQty"
                name="deliveredQty"
                type="number"
                min={0}
                defaultValue={initial?.deliveredQty ?? 0}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                name="status"
                defaultValue={initial?.status ?? "PLANEJADO"}
              >
                <option value="PLANEJADO">Planejado</option>
                <option value="EM_ANDAMENTO">Em andamento</option>
                <option value="CONCLUIDO">Concluído</option>
                <option value="ATRASADO">Atrasado</option>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Detalhes da entrega (opcional)"
              defaultValue={initial?.description ?? ""}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Observações</Label>
            <Input
              id="notes"
              name="notes"
              placeholder="Observações rápidas (opcional)"
              defaultValue={initial?.notes ?? ""}
            />
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
