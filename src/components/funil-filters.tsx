"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export function FunilFilters({
  stages,
  owners,
  companies,
  current,
}: {
  stages: string[];
  owners: string[];
  companies: string[];
  current: {
    etapa?: string;
    responsavel?: string;
    empresa?: string;
    status?: string;
    valorMin?: string;
    ate?: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  }

  const hasFilters = Object.values(current).some(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        className="h-8 w-auto text-xs"
        value={current.status ?? "open"}
        onChange={(e) => setParam("status", e.target.value)}
        aria-label="Status"
      >
        <option value="open">Abertos</option>
        <option value="won">Ganhos</option>
        <option value="lost">Perdidos</option>
        <option value="all">Todos os status</option>
      </Select>

      <Select
        className="h-8 w-auto text-xs"
        value={current.etapa ?? "all"}
        onChange={(e) => setParam("etapa", e.target.value)}
        aria-label="Etapa"
      >
        <option value="all">Todas as etapas</option>
        {stages.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>

      <Select
        className="h-8 w-auto text-xs"
        value={current.responsavel ?? "all"}
        onChange={(e) => setParam("responsavel", e.target.value)}
        aria-label="Responsável"
      >
        <option value="all">Todos os responsáveis</option>
        {owners.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>

      <Select
        className="h-8 w-auto text-xs"
        value={current.empresa ?? "all"}
        onChange={(e) => setParam("empresa", e.target.value)}
        aria-label="Empresa"
      >
        <option value="all">Todas as empresas</option>
        {companies.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>

      <Input
        type="number"
        min={0}
        step={1000}
        placeholder="Valor mín."
        className="h-8 w-28 text-xs"
        defaultValue={current.valorMin ?? ""}
        onBlur={(e) => setParam("valorMin", e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") setParam("valorMin", e.currentTarget.value);
        }}
        aria-label="Valor mínimo"
      />

      <Input
        type="date"
        className="h-8 w-36 text-xs"
        defaultValue={current.ate ?? ""}
        onChange={(e) => setParam("ate", e.target.value)}
        aria-label="Previsão até"
        title="Previsão de fechamento até"
      />

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(pathname)}
          className="h-8 text-xs"
        >
          <X className="h-3.5 w-3.5" /> Limpar
        </Button>
      )}
    </div>
  );
}
