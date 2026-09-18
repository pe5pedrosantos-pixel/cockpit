"use client";

import { useState, useTransition } from "react";
import { Repeat, Trophy } from "lucide-react";
import { setDealRecurrence } from "@/lib/actions/pipedrive";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { brl, dateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface WonDealRow {
  id: number;
  title: string;
  orgName: string | null;
  value: number;
  wonAt: string | null;
  isRecurring: boolean;
  monthly: number;
}

export function WonDeals({ deals }: { deals: WonDealRow[] }) {
  if (deals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum negócio ganho ainda.
      </p>
    );
  }
  return (
    <div className="flex flex-col divide-y divide-border">
      {deals.map((d) => (
        <WonDealItem key={d.id} deal={d} />
      ))}
    </div>
  );
}

function WonDealItem({ deal }: { deal: WonDealRow }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [monthly, setMonthly] = useState(
    deal.monthly > 0 ? String(deal.monthly) : ""
  );

  function toggle() {
    const next = !deal.isRecurring;
    startTransition(() =>
      setDealRecurrence(deal.id, next, next ? Number(monthly) || null : null)
    );
    if (next) setEditing(true);
  }

  function saveMonthly() {
    setEditing(false);
    startTransition(() =>
      setDealRecurrence(deal.id, true, Number(monthly) || null)
    );
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{deal.title}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {deal.orgName ?? "—"}
          {deal.wonAt && ` · fechado em ${dateShort(deal.wonAt)}`}
        </p>
      </div>

      <div className="text-right">
        <p className="text-sm font-semibold tabular-nums">{brl(deal.value)}</p>
        {deal.isRecurring && !editing && deal.monthly > 0 && (
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {brl(deal.monthly)}/mês
          </p>
        )}
      </div>

      {editing ? (
        <Input
          type="number"
          min={0}
          step={100}
          autoFocus
          value={monthly}
          onChange={(e) => setMonthly(e.target.value)}
          onBlur={saveMonthly}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveMonthly();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="R$/mês"
          className="h-7 w-24 text-xs"
          aria-label="Valor mensal"
        />
      ) : (
        <button
          onClick={toggle}
          disabled={isPending}
          title={
            deal.isRecurring
              ? "Contrato recorrente — clique para desmarcar"
              : "Marcar como receita recorrente"
          }
          className={cn(
            "shrink-0 rounded-md p-1.5 transition-colors cursor-pointer",
            deal.isRecurring
              ? "bg-indigo-50 text-indigo-600"
              : "text-zinc-300 hover:bg-muted hover:text-zinc-500"
          )}
          aria-label="Alternar receita recorrente"
        >
          <Repeat className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function WonHeader({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Trophy className="h-3.5 w-3.5 text-amber-500" />
      Negócios fechados
      {count > 0 && (
        <Badge tone="success" className="ml-1">
          {count} no mês
        </Badge>
      )}
    </span>
  );
}
