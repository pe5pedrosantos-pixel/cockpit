"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { createTask, updateTask } from "@/lib/actions/tasks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";

export interface TaskFormData {
  id?: number;
  title?: string;
  description?: string | null;
  companyId?: number | null;
  dueDate?: string | null;
  priority?: string;
  status?: string;
}

export function TaskFormDialog({
  companies,
  initial,
  defaultCompanyId,
  trigger = "button",
}: {
  companies: { id: number; name: string }[];
  initial?: TaskFormData;
  defaultCompanyId?: number;
  trigger?: "button" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isEdit = !!initial?.id;

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      if (isEdit) await updateTask(initial!.id!, formData);
      else await createTask(formData);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger === "button" ? (
          <Button size="sm">
            <Plus className="h-4 w-4" /> Nova tarefa
          </Button>
        ) : (
          <Button variant="ghost" size="icon" aria-label="Editar tarefa">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={isEdit ? "Editar tarefa" : "Nova tarefa"}>
        <form action={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-title">Título</Label>
            <Input
              id="t-title"
              name="title"
              required
              placeholder="Ex.: Enviar apresentação para cliente X"
              defaultValue={initial?.title ?? ""}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-company">Empresa</Label>
              <Select
                id="t-company"
                name="companyId"
                defaultValue={initial?.companyId ?? defaultCompanyId ?? ""}
              >
                <option value="">Pessoal</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-due">Prazo</Label>
              <Input
                id="t-due"
                name="dueDate"
                type="date"
                defaultValue={initial?.dueDate ?? ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-priority">Prioridade</Label>
              <Select
                id="t-priority"
                name="priority"
                defaultValue={initial?.priority ?? "MEDIA"}
              >
                <option value="BAIXA">Baixa</option>
                <option value="MEDIA">Média</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-status">Status</Label>
              <Select
                id="t-status"
                name="status"
                defaultValue={initial?.status ?? "A_FAZER"}
              >
                <option value="A_FAZER">A fazer</option>
                <option value="EM_ANDAMENTO">Em andamento</option>
                <option value="CONCLUIDA">Concluída</option>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-desc">Descrição</Label>
            <Textarea
              id="t-desc"
              name="description"
              placeholder="Detalhes (opcional)"
              defaultValue={initial?.description ?? ""}
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
