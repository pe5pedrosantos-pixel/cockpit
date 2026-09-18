"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { syncPipedriveAction } from "@/lib/actions/pipedrive";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Considera os dados "velhos" depois deste tempo. */
const STALE_MS = 30 * 60 * 1000;

export function SyncButton({
  lastSyncAt,
  configured,
  auto = false,
  size = "sm",
}: {
  lastSyncAt: string | null;
  configured: boolean;
  /** Sincroniza sozinho ao abrir a página se os dados estiverem velhos. */
  auto?: boolean;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const autoRan = useRef(false);

  function run() {
    startTransition(async () => {
      try {
        const result = await syncPipedriveAction();
        setFeedback({ ok: result.ok, message: result.message });
        router.refresh();
      } catch {
        setFeedback({
          ok: false,
          message: "Não foi possível sincronizar agora.",
        });
      }
    });
  }

  // sincronização automática ao abrir, quando os dados estão velhos
  useEffect(() => {
    if (!auto || !configured || autoRan.current) return;
    autoRan.current = true;
    const age = lastSyncAt ? Date.now() - new Date(lastSyncAt).getTime() : Infinity;
    if (age > STALE_MS) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, configured, lastSyncAt]);

  if (!configured) return null;

  return (
    <div className="flex items-center gap-2">
      {feedback && (
        <span
          className={cn(
            "text-xs",
            feedback.ok ? "text-success" : "text-danger"
          )}
        >
          {feedback.message}
        </span>
      )}
      <Button variant="outline" size={size} onClick={run} disabled={isPending}>
        <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
        {isPending ? "Sincronizando…" : "Sincronizar agora"}
      </Button>
    </div>
  );
}
