"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Faixa horizontal de colunas com navegação explícita.
 *
 * Um funil com 7 etapas não cabe na tela, e rolagem horizontal sem
 * affordance é invisível: as setas, o esmaecido nas bordas e os atalhos
 * de etapa dizem que há mais conteúdo e como chegar nele.
 */
export function KanbanScroller({
  stages,
  children,
}: {
  /** Nomes das colunas, na ordem — viram atalhos de navegação. */
  stages: string[];
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [current, setCurrent] = useState(0);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ left: el.scrollLeft > 8, right: el.scrollLeft < max - 8 });

    const cols = Array.from(el.children) as HTMLElement[];
    const idx = cols.findIndex((c) => c.offsetLeft + c.offsetWidth > el.scrollLeft + 24);
    setCurrent(idx < 0 ? 0 : idx);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure, children]);

  const scrollToColumn = (index: number) => {
    const el = ref.current;
    if (!el) return;
    const col = el.children[index] as HTMLElement | undefined;
    if (col) el.scrollTo({ left: col.offsetLeft - 4, behavior: "smooth" });
  };

  const step = (dir: -1 | 1) => scrollToColumn(Math.max(0, current + dir));

  return (
    <div className="flex flex-col gap-2.5">
      {/* atalhos para cada etapa */}
      <div className="flex flex-wrap items-center gap-1.5">
        {stages.map((s, i) => (
          <button
            key={s}
            onClick={() => scrollToColumn(i)}
            className={cn(
              "rounded px-2 py-1 text-[11.5px] transition-colors cursor-pointer",
              i === current
                ? "bg-navy text-on-navy"
                : "bg-black/[0.04] text-ink-muted hover:bg-black/[0.08] hover:text-ink"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="relative">
        {/* esmaecido indicando conteúdo além da borda */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent transition-opacity",
            edges.left ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent transition-opacity",
            edges.right ? "opacity-100" : "opacity-0"
          )}
        />

        <button
          onClick={() => step(-1)}
          disabled={!edges.left}
          aria-label="Etapa anterior"
          className={cn(
            "absolute left-1 top-3 z-20 grid h-8 w-8 place-items-center rounded-full border border-border bg-paper text-ink shadow-sm transition-opacity hover:bg-cream cursor-pointer",
            edges.left ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => step(1)}
          disabled={!edges.right}
          aria-label="Próxima etapa"
          className={cn(
            "absolute right-1 top-3 z-20 grid h-8 w-8 place-items-center rounded-full border border-border bg-paper text-ink shadow-sm transition-opacity hover:bg-cream cursor-pointer",
            edges.right ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <div
          ref={ref}
          tabIndex={0}
          role="group"
          aria-label="Etapas do funil"
          className="kanban-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-3 focus-visible:outline-none"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
