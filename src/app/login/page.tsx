"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Wordmark } from "@/components/wordmark";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <main className="grid min-h-screen md:grid-cols-[1fr_1.1fr]">
      {/* Campo da marca */}
      <div className="flex items-center justify-center bg-sidebar px-8 py-14 md:py-8">
        <Wordmark tone="light" size="lg" tagline="Vendas e entregas" />
      </div>

      {/* Entrada */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[19rem]">
          <h1 className="font-display text-[22px] font-extrabold tracking-[-0.02em]">
            Entrar
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ink-muted">
            Seu comercial, suas entregas e seus prazos em uma tela.
          </p>

          <form action={formAction} className="mt-7 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="voce@email.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            </div>

            {state?.error && (
              <p className="rounded-md bg-attention-bg px-3 py-2 text-[13px] text-coral">
                {state.error}
              </p>
            )}

            <Button type="submit" variant="coral" disabled={pending} className="mt-1">
              {pending ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
