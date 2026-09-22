"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { addItem } from "@/lib/actions/items";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { monthLabel, todayISO } from "@/lib/format";
import { FORMATS, PLATFORMS } from "@/lib/platforms";
import { cn } from "@/lib/utils";

/**
 * Registrar uma publicação que já foi ao ar, com ou sem link. Conta para as
 * metas na hora — é o caminho para "publiquei hoje" sem criar uma entrega.
 */
export function PublicationFormDialog({
  companyId,
  companyName,
  defaultMonth,
}: {
  companyId: number;
  companyName: string;
  defaultMonth: string;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setResult(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CheckCircle2 className="h-3.5 w-3.5" /> Publiquei agora
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Registrar publicação de ${companyName}`}
        description="Conta para as metas na hora. O link pode entrar depois."
      >
        <form
          action={(fd) => {
            fd.set("companyId", String(companyId));
            fd.set("monthRef", (fd.get("publishedAt") as string).slice(0, 7) || defaultMonth);
            setResult(null);
            startTransition(async () => {
              const r = await addItem(fd);
              setResult(r);
              if (r.ok) setTimeout(() => setOpen(false), 800);
            });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pub-title">O que foi publicado</Label>
            <Input
              id="pub-title"
              name="title"
              required
              placeholder="Ex.: Post sobre Spin Selling"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pub-platform">Rede</Label>
              <Select id="pub-platform" name="platform" defaultValue="instagram">
                {Object.entries(PLATFORMS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pub-format">Formato</Label>
              <Select id="pub-format" name="format" defaultValue="">
                <option value="">Sem formato</option>
                {Object.entries(FORMATS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pub-date">Data</Label>
              <Input
                id="pub-date"
                name="publishedAt"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pub-url">Link (opcional)</Label>
            <Input id="pub-url" name="url" type="url" placeholder="https://" />
          </div>
          <p className="text-[12px] text-ink-muted">
            Vai para {monthLabel(date.slice(0, 7) || defaultMonth)}. Publicou a mesma
            peça em outra rede? Registre uma vez para cada uma.
          </p>
          {result && (
            <p
              className={cn(
                "rounded-md px-3 py-2 text-[13px]",
                result.ok ? "bg-money/10 text-money" : "bg-attention-bg text-coral"
              )}
            >
              {result.message}
            </p>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Registrando…" : "Registrar publicação"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
