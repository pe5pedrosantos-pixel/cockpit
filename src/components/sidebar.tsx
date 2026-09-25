"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Building2,
  Calendar,
  CheckSquare,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  Package,
  Plug,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/actions/auth-actions";
import { Wordmark } from "@/components/wordmark";

interface CompanyNav {
  name: string;
  slug: string;
  color: string;
}

export function Sidebar({ companies }: { companies: CompanyNav[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  /** Item ativo é marcado por uma barra coral à esquerda — como um
   *  interruptor acionado, não uma pílula preenchida. */
  const item = (
    href: string,
    label: string,
    icon: React.ReactNode,
    exact = false
  ) => {
    const active = exact ? pathname === href : pathname.startsWith(href);
    return (
      <Link
        prefetch={false}
        key={href}
        href={href}
        onClick={() => setOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex items-center gap-3 rounded-r-md py-2 pl-4 pr-3 text-[13.5px] transition-colors",
          active
            ? "bg-white/[0.07] font-semibold text-on-navy"
            : "text-on-navy-muted hover:bg-white/[0.04] hover:text-on-navy"
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-coral" />
        )}
        <span className={cn(active ? "text-coral" : "text-on-navy-muted")}>
          {icon}
        </span>
        {label}
      </Link>
    );
  };

  const section = (label: string) => (
    <p className="mb-1 mt-6 pl-4 text-[11px] font-medium text-on-navy-muted/70">
      {label}
    </p>
  );

  const nav = (
    <nav className="flex h-full flex-col gap-0.5 pb-4 pr-3">
      <div className="mb-5 pl-4 pt-6">
        <Wordmark tone="light" size="md" tagline="Vendas e entregas" />
      </div>

      {item("/", "Dashboard", <LayoutDashboard className="h-4 w-4" />, true)}

      {section("Comercial")}
      {item("/funil", "Funil da SOBE", <TrendingUp className="h-4 w-4" />)}
      {item("/clientes", "Clientes", <Users className="h-4 w-4" />)}
      {item("/leads", "Funil Pedro Santos", <Mic className="h-4 w-4" />)}

      {section("Entregas")}
      {companies.map((c) => {
        const href = `/empresas/${c.slug}`;
        const active = pathname === href;
        return (
          <Link
            prefetch={false}
            key={c.slug}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-r-md py-2 pl-4 pr-3 text-[13.5px] transition-colors",
              active
                ? "bg-white/[0.07] font-semibold text-on-navy"
                : "text-on-navy-muted hover:bg-white/[0.04] hover:text-on-navy"
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-coral" />
            )}
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: c.color }}
            />
            {c.name}
          </Link>
        );
      })}
      {item("/entregas", "Todas as entregas", <Package className="h-4 w-4" />)}

      {section("Organização")}
      {item("/tarefas", "Tarefas", <CheckSquare className="h-4 w-4" />)}
      {item("/calendario", "Calendário", <Calendar className="h-4 w-4" />)}

      <div className="mt-auto flex flex-col gap-0.5 border-t border-white/10 pt-4">
        {item("/cadastros", "Cadastros", <Building2 className="h-4 w-4" />)}
        {item("/integracoes", "Integrações", <Plug className="h-4 w-4" />)}
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-r-md py-2 pl-4 pr-3 text-[13.5px] text-on-navy-muted transition-colors hover:bg-white/[0.04] hover:text-on-navy cursor-pointer"
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
      <div className="flex items-center justify-between bg-sidebar px-4 py-3 md:hidden">
        <Wordmark tone="light" size="sm" />
        <button
          onClick={() => setOpen(!open)}
          className="rounded-md p-1.5 text-on-navy hover:bg-white/10"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && <div className="bg-sidebar md:hidden">{nav}</div>}

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 overflow-y-auto bg-sidebar md:block">
        {nav}
      </aside>
    </>
  );
}
