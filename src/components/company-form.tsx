"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { createCompany, updateCompany } from "@/lib/actions/registry";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";

export interface CompanyFormData {
  id?: number;
  name?: string;
  color?: string;
  description?: string | null;
  hasDeliverables?: boolean;
  isActive?: boolean;
}

export function CompanyFormDialog({ initial }: { initial?: CompanyFormData }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isEdit = !!initial?.id;

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      if (isEdit) await updateCompany(initial!.id!, formData);
      else await createCompany(formData);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" aria-label="Editar empresa">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="h-4 w-4" /> Nova empresa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={isEdit ? "Editar empresa" : "Nova empresa"}>
        <form action={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-name">Nome</Label>
            <Input
              id="c-name"
              name="name"
              required
              placeholder="Ex.: GRID CO"
              defaultValue={initial?.name ?? ""}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-color">Cor</Label>
              <Input
                id="c-color"
                name="color"
                type="color"
                className="h-9 p-1"
                defaultValue={initial?.color ?? "#6366f1"}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-desc">Descrição</Label>
              <Input
                id="c-desc"
                name="description"
                placeholder="Opcional"
                defaultValue={initial?.description ?? ""}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="hasDeliverables"
              defaultChecked={initial?.hasDeliverables ?? true}
              className="h-4 w-4 rounded border-border-strong accent-coral"
            />
            Gerencio entregáveis de marketing para esta empresa
          </label>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={initial?.isActive ?? true}
                className="h-4 w-4 rounded border-border-strong accent-coral"
              />
              Empresa ativa
            </label>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
