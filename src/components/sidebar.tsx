"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Building2,
  Calendar,
  CheckSquare,
  DollarSign,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Plug,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/actions/auth-actions";

interface CompanyNav {
  name: string;
  slug: string;
  color: string;
}

export function Sidebar({ companies }: { companies: CompanyNav[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const item = (
    href: string,
    label: string,
    icon: React.ReactNode,
    exact = false
  ) => {
    const active = exact ? pathname === href : pathname.startsWith(href);
    return (
      <Link
        href={href}
        onClick={() => setOpen(false)}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-indigo-50 text-indigo-700"
            : "text-zinc-600 hover:bg-muted hover:text-foreground"
        )}
      >
        {icon}
        {label}
      </Link>
    );
  };

  const nav = (
    <nav className="flex h-full flex-col gap-0.5 p-3">
      <div className="mb-4 flex items-center gap-2.5 px-3 pt-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Gauge className="h-4.5 w-4.5" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight">
          Cockpit
        </span>
      </div>

      {item("/", "Dashboard", <LayoutDashboard className="h-4 w-4" />, true)}

      <p className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Comercial
      </p>
      {item("/funil", "Funil de Vendas · SOBE", <DollarSign className="h-4 w-4" />)}

      <p className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Atividades
      </p>
      {companies.map((c) => (
        <Link
          key={c.slug}
          href={`/empresas/${c.slug}`}
          onClick={() => setOpen(false)}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname === `/empresas/${c.slug}`
              ? "bg-indigo-50 text-indigo-700"
              : "text-zinc-600 hover:bg-muted hover:text-foreground"
          )}
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: c.color }}
          />
          {c.name}
        </Link>
      ))}
      {item("/entregas", "Entregas", <CheckSquare className="h-4 w-4" />)}

      <p className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Organização
      </p>
      {item("/tarefas", "Tarefas", <CheckSquare className="h-4 w-4" />)}
      {item("/calendario", "Calendário", <Calendar className="h-4 w-4" />)}

      <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
        {item("/cadastros", "Cadastros", <Building2 className="h-4 w-4" />)}
        {item("/integracoes", "Integrações", <Plug className="h-4 w-4" />)}
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-muted cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <>
      {/* mobile top bar */}
      <div className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Gauge className="h-4 w-4" />
          </div>
          <span className="font-semibold">Cockpit</span>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-md p-1.5 hover:bg-muted"
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="border-b border-border bg-sidebar md:hidden">{nav}</div>
      )}

      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-border bg-sidebar md:block">
        {nav}
      </aside>
    </>
  );
}
