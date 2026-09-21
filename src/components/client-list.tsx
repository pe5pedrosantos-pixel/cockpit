"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Mail, NotebookPen, Phone, Search } from "lucide-react";
import type { ClientRow } from "@/lib/queries";
import { activityWhen } from "@/lib/activities";
import { ActivityFormDialog, NoteFormDialog } from "@/components/crm-activities";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<ClientRow["status"], string> = {
  cliente: "Cliente",
  negociacao: "Em negociação",
  perdido: "Só perdidos",
  "sem-negocio": "Sem negócio",
};

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function ClientList({ clients }: { clients: ClientRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("ativos");
  const today = todayISO();

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const x of clients) c[x.status] = (c[x.status] ?? 0) + 1;
    return c;
  }, [clients]);

  const visible = useMemo(() => {
    const term = normalize(q.trim());
    return clients.filter((c) => {
      if (status === "ativos" && c.status !== "cliente" && c.status !== "negociacao") return false;
      if (status !== "ativos" && status !== "todos" && c.status !== status) return false;
      if (!term) return true;
      return (
        normalize(c.name).includes(term) ||
        c.contacts.some(
          (p) =>
            normalize(p.name).includes(term) ||
            (p.email && normalize(p.email).includes(term))
        ) ||
        c.openDeals.some((d) => normalize(d.title).includes(term))
      );
    });
  }, [clients, q, status]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar empresa, contato ou negócio"
            className="h-8 pl-8 text-[13px]"
            aria-label="Buscar clientes"
          />
        </div>
        <Select
          className="h-8 w-auto text-xs"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Situação"
        >
          <option value="ativos">
            Clientes e em negociação ({(counts.cliente ?? 0) + (counts.negociacao ?? 0)})
          </option>
          <option value="cliente">Clientes ({counts.cliente ?? 0})</option>
          <option value="negociacao">Em negociação ({counts.negociacao ?? 0})</option>
          <option value="perdido">Só perdidos ({counts.perdido ?? 0})</option>
          <option value="sem-negocio">Sem negócio ({counts["sem-negocio"] ?? 0})</option>
          <option value="todos">Todos ({clients.length})</option>
        </Select>
        <span className="text-[12px] text-ink-muted">
          {visible.length} {visible.length === 1 ? "empresa" : "empresas"}
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-[13.5px] text-ink-muted">
          Nenhuma empresa encontrada.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-paper">
          {visible.map((c, i) => {
            const target = { orgPipedriveId: c.pipedriveId, label: c.name };
            const needsNext = c.status === "negociacao" && !c.nextActivity;
            return (
              <div
                key={c.pipedriveId}
                className={cn(
                  "group grid gap-3 px-4 py-3.5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] md:items-start",
                  i > 0 && "border-t border-border"
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold">{c.name}</p>
                  <p className="text-[11.5px] text-ink-muted">
                    {STATUS_LABEL[c.status]}
                    {c.wonDeals > 0 && c.status === "cliente"
                      ? `, ${c.wonDeals} ${c.wonDeals === 1 ? "negócio ganho" : "negócios ganhos"}`
                      : ""}
                    {c.ownerName ? `, com ${c.ownerName}` : ""}
                  </p>
                  {c.openDeals.length > 0 && (
                    <ul className="mt-1.5 flex flex-col gap-0.5">
                      {c.openDeals.slice(0, 3).map((d) => (
                        <li key={d.id} className="truncate text-[12px]">
                          {d.title}
                          {d.stageName && (
                            <span className="text-ink-muted"> em {d.stageName}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex min-w-0 flex-col gap-1">
                  {c.contacts.length === 0 && (
                    <span className="text-[12px] text-ink-faint">Sem contato cadastrado</span>
                  )}
                  {c.contacts.slice(0, 3).map((p, j) => (
                    <div key={j} className="min-w-0 text-[12px]">
                      <p className="truncate font-medium">{p.name}</p>
                      <div className="flex flex-wrap gap-x-3 text-ink-muted">
                        {p.email && (
                          <a
                            href={`mailto:${p.email}`}
                            className="inline-flex min-w-0 items-center gap-1 hover:text-coral"
                          >
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{p.email}</span>
                          </a>
                        )}
                        {p.phone && (
                          <a
                            href={`https://wa.me/${p.phone.replace(/\D/g, "").replace(/^(?!55)(\d{10,11})$/, "55$1")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:text-coral"
                          >
                            <Phone className="h-3 w-3 shrink-0" />
                            {p.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  {c.contacts.length > 3 && (
                    <span className="text-[11.5px] text-ink-faint">
                      e mais {c.contacts.length - 3}
                    </span>
                  )}
                </div>

                <div className="min-w-0 text-[12px]">
                  {c.nextActivity ? (
                    <>
                      <p className="truncate">{c.nextActivity.subject}</p>
                      <p
                        className={cn(
                          "text-ink-muted",
                          c.nextActivity.overdue && "font-semibold text-coral"
                        )}
                      >
                        {activityWhen(c.nextActivity.day, c.nextActivity.time, today)}
                      </p>
                    </>
                  ) : (
                    <p className={cn(needsNext ? "text-ink" : "text-ink-faint")}>
                      {needsNext ? "Sem próximo passo" : "Nada agendado"}
                    </p>
                  )}
                </div>

                <div className="flex gap-1">
                  <ActivityFormDialog
                    target={target}
                    trigger={
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Nova atividade para ${c.name}`}>
                        <CalendarPlus className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <NoteFormDialog
                    target={target}
                    trigger={
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Registrar nota para ${c.name}`}>
                        <NotebookPen className="h-4 w-4" />
                      </Button>
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
