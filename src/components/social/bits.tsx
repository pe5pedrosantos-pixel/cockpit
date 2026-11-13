"use client";

import { useCallback, useState, useTransition } from "react";
import { background, postStatusLabel } from "@/lib/social/constants";
import { cn } from "@/lib/utils";
import type { LineData } from "@/components/social/types";

type ActionResult = { ok: boolean; message: string };

/**
 * Executa uma server action e guarda a mensagem de retorno.
 * As actions já revalidam a página: a tela se atualiza sozinha.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = useCallback(
    <T extends ActionResult>(fn: () => Promise<T>, after?: (r: T) => void) =>
      startTransition(async () => {
        try {
          const r = await fn();
          setMsg(r.message ? { ok: r.ok, text: r.message } : null);
          after?.(r);
        } catch {
          setMsg({ ok: false, text: "Não foi possível concluir. Tente de novo." });
        }
      }),
    []
  );
  return { pending, msg, setMsg, run };
}

export function Feedback({ msg, className }: { msg: { ok: boolean; text: string } | null; className?: string }) {
  if (!msg) return null;
  return (
    <p
      role="status"
      className={cn(
        "rounded-md px-3 py-2 text-[12.5px]",
        msg.ok ? "bg-money/10 text-money" : "bg-attention-bg text-coral",
        className
      )}
    >
      {msg.text}
    </p>
  );
}

/** Status do post. Só "aguardando seu OK" usa coral: é o que pede você. */
export function PostStatusBadge({ status, className }: { status: string; className?: string }) {
  const tone =
    status === "aguardando_ok"
      ? "bg-attention-bg text-coral"
      : status === "agendado" || status === "publicado"
        ? "bg-money/10 text-money"
        : status === "aprovado"
          ? "bg-navy/10 text-navy"
          : status === "cancelado"
            ? "bg-black/[0.05] text-ink-faint line-through"
            : "bg-black/[0.05] text-ink-muted";
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium", tone, className)}>
      {postStatusLabel(status)}
    </span>
  );
}

/** Amostra do fundo da peça (branco, laranja, azul-marinho, vídeo). */
export function BgSwatch({ value, size = "sm", className }: { value: string | null; size?: "sm" | "md"; className?: string }) {
  const bg = background(value);
  if (!bg) return null;
  return (
    <span
      title={`Fundo ${bg.label.toLowerCase()}`}
      className={cn(
        "inline-block shrink-0 rounded-[3px] border border-border-strong",
        size === "sm" ? "h-2.5 w-2.5" : "h-4 w-4",
        className
      )}
      style={{ backgroundColor: bg.hex }}
    />
  );
}

export function LineDot({ line, className }: { line: LineData | undefined; className?: string }) {
  if (!line) return null;
  return (
    <span
      title={line.name}
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: line.color }}
    />
  );
}

export function SectionTitle({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-[14px] font-semibold tracking-tight text-ink">{children}</h2>
      {note && <span className="text-[12px] text-ink-muted">{note}</span>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-paper p-6 text-center text-[13px] text-ink-muted">
      {children}
    </div>
  );
}
