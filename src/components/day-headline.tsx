import Link from "next/link";
import type { Alert } from "@/lib/alerts";
import { cn } from "@/lib/utils";

/**
 * A primeira coisa que Pedro lê de manhã: uma frase dizendo o que precisa
 * dele hoje. Os números vêm depois — eles detalham a frase, não a
 * substituem.
 */
export function DayHeadline({
  greeting,
  dateLabel,
  alerts,
}: {
  greeting: string;
  dateLabel: string;
  alerts: Alert[];
}) {
  const urgent = alerts.filter((a) => a.level === "critical");
  const warnings = alerts.filter((a) => a.level === "warning");
  const calm = urgent.length === 0 && warnings.length === 0;

  return (
    <header className="max-w-2xl">
      <p className="text-[13px] text-ink-muted">
        {greeting}, Pedro. Hoje é {dateLabel}.
      </p>

      <h1
        className={cn(
          "mt-2 font-display text-[27px] font-extrabold leading-[1.18] tracking-[-0.025em] md:text-[32px]",
          calm ? "text-ink" : "text-ink"
        )}
      >
        {calm ? (
          "Nada atrasado. O dia está seu."
        ) : (
          <>
            {urgent.length > 0 ? (
              <>
                <span className="text-coral">
                  {urgent.length === 1
                    ? "1 coisa está atrasada"
                    : `${urgent.length} coisas estão atrasadas`}
                </span>
                {warnings.length > 0 && (
                  <>
                    {" e "}
                    {warnings.length === 1
                      ? "1 pede atenção"
                      : `${warnings.length} pedem atenção`}
                  </>
                )}
                .
              </>
            ) : (
              <>
                {warnings.length === 1
                  ? "1 coisa pede sua atenção"
                  : `${warnings.length} coisas pedem sua atenção`}
                .
              </>
            )}
          </>
        )}
      </h1>

      {!calm && (
        <ul className="mt-4 flex flex-col gap-2">
          {[...urgent, ...warnings].map((a, i) => (
            <li key={i} className="flex gap-2.5 text-[13.5px] leading-snug">
              <span
                className={cn(
                  "mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full",
                  a.level === "critical" ? "bg-coral" : "bg-ink-faint"
                )}
              />
              <span className={a.level === "critical" ? "text-ink" : "text-ink-muted"}>
                {a.message}
              </span>
            </li>
          ))}
        </ul>
      )}

      {calm && (
        <p className="mt-3 text-[13.5px] text-ink-muted">
          Boa hora para adiantar o que vence semana que vem — veja em{" "}
          <Link href="/entregas" className="text-coral underline underline-offset-2">
            entregas
          </Link>
          .
        </p>
      )}
    </header>
  );
}
