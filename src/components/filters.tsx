"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/input";
import { monthLabel, monthOptions } from "@/lib/format";

export function EntregasFilters({
  companies,
  selectedCompany,
  selectedMonth,
  showCompany = true,
}: {
  companies: { id: number; name: string; slug: string }[];
  selectedCompany?: string; // slug ou "all"
  selectedMonth: string;
  showCompany?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showCompany && (
        <Select
          className="w-auto min-w-36"
          value={selectedCompany ?? "all"}
          onChange={(e) => setParam("empresa", e.target.value)}
          aria-label="Empresa"
        >
          <option value="all">Todas as empresas</option>
          {companies.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
      <Select
        className="w-auto min-w-36"
        value={selectedMonth}
        onChange={(e) => setParam("mes", e.target.value)}
        aria-label="Mês"
      >
        {monthOptions().map((m) => (
          <option key={m} value={m}>
            {monthLabel(m)}
          </option>
        ))}
      </Select>
    </div>
  );
}
