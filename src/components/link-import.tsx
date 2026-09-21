"use client";

import { useMemo, useState, useTransition } from "react";
import { Link2 } from "lucide-react";
import { importItems } from "@/lib/actions/items";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { monthLabel, monthOptions } from "@/lib/format";
import { FORMATS, formatLabel, parseLinks, platformLabel } from "@/lib/platforms";
import { cn } from "@/lib/utils";

export interface TargetDeliverable {
  id: number;
  title: string;
  monthRef: string;
}

/**
 * Colar vários links de uma vez — pensado para o histórico retroativo.
 * Mostra antes de salvar o que foi reconhecido em cada linha.
 */
export function LinkImportDialog({
  companyId,
  companyName,
  defaultMonth,
  deliverables,
  goalsOnly = false,
}: {
  companyId: number;
  companyName: string;
  defaultMonth: string;
  deliverables: TargetDeliverable[];
  /** empresa acompanhada por metas: por padrão só registra, sem criar entregas */
  goalsOnly?: boolean;
}) {
  const baseTarget = goalsOnly ? "none" : "auto";
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [month, setMonth] = useState(defaultMonth);
  const [target, setTarget] = useState<string>(baseTarget);
  const [date, setDate] = useState("");
  const [format, setFormat] = useState<string>("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const links = useMemo(() => parseLinks(text), [text]);
  const valid = links.filter((l) => l.valid);
  const invalid = links.filter((l) => !l.valid);
  const monthDeliverables = deliverables.filter((d) => d.monthRef === month);

  const byPlatform = valid.reduce<Record<string, number>>((acc, l) => {
    acc[l.platform] = (acc[l.platform] ?? 0) + 1;
    return acc;
  }, {});

  function save() {
    setResult(null);
    startTransition(async () => {
      const r = await importItems({
        companyId,
        monthRef: month,
        target: target === "auto" || target === "none" ? target : Number(target),
        publishedAt: date || null,
        links: valid.map((l) => ({
          url: l.url,
          platform: l.platform,
          // o formato escolhido vale para os links cujo formato a URL não revela
          format: l.format ?? (format || null),
        })),
      });
      setResult(r);
      if (r.ok) setText("");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setResult(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Link2 className="h-3.5 w-3.5" /> Colar links
        </Button>
      </DialogTrigger>
      <DialogContent title={`Registrar links de ${companyName}`} className="max-w-xl">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="li-month">Mês das publicações</Label>
              <Select
                id="li-month"
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setTarget(baseTarget);
                }}
              >
                {monthOptions(8, 1).map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="li-date">Data (opcional)</Label>
              <Input
                id="li-date"
                type="date"
                value={date}
                min={`${month}-01`}
                max={`${month}-31`}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="li-target">Anexar a</Label>
              <Select id="li-target" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="none">Só registrar (conta para as metas)</option>
                <option value="auto">Criar entregas por rede</option>
                {monthDeliverables.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="li-format">Formato</Label>
              <Select id="li-format" value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="">Identificar pelo link</option>
                {Object.entries(FORMATS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="li-links">Links, um por linha</Label>
            <Textarea
              id="li-links"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"https://www.instagram.com/p/…\nhttps://www.linkedin.com/posts/…"}
              className="min-h-[140px] font-mono text-[12px]"
            />
          </div>

          {links.length > 0 && (
            <div className="rounded-md bg-black/[0.03] px-3 py-2.5 text-[12.5px]">
              <p className="text-ink">
                {valid.length} {valid.length === 1 ? "link reconhecido" : "links reconhecidos"}
                {Object.keys(byPlatform).length > 0 && (
                  <span className="text-ink-muted">
                    {": "}
                    {Object.entries(byPlatform)
                      .map(([p, n]) => `${n} ${platformLabel(p)}`)
                      .join(", ")}
                  </span>
                )}
              </p>
              {invalid.length > 0 && (
                <p className="mt-1 text-coral">
                  {invalid.length} {invalid.length === 1 ? "linha não parece" : "linhas não parecem"} um
                  link e {invalid.length === 1 ? "será ignorada" : "serão ignoradas"}.
                </p>
              )}
              <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
                {links.slice(0, 50).map((l, i) => (
                  <li
                    key={i}
                    className={cn("flex items-center gap-2 text-[11.5px]", !l.valid && "text-ink-faint line-through")}
                  >
                    <span className="w-16 shrink-0 text-ink-muted">{platformLabel(l.platform)}</span>
                    <span className="truncate">{l.url}</span>
                    {l.format && (
                      <span className="ml-auto shrink-0 text-ink-faint">{formatLabel(l.format)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {target === "auto" && valid.length > 0 && monthDeliverables.length > 0 && (
            <p className="text-[12px] text-ink-muted">
              Já existem entregas em {monthLabel(month).toLowerCase()}. Se esses links
              documentam uma delas, escolha-a em &ldquo;Anexar a&rdquo; para não contar em dobro.
            </p>
          )}

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

          <Button onClick={save} disabled={isPending || valid.length === 0}>
            {isPending
              ? "Registrando…"
              : valid.length > 0
                ? `Registrar ${valid.length} ${valid.length === 1 ? "link" : "links"}`
                : "Registrar links"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
