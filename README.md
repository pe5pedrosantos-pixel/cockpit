# Cockpit — Plataforma Pessoal de Gestão Comercial e Entregas

Cockpit pessoal de trabalho: **comercial + tarefas + entregas + prazos + prioridades** em uma visão única.

- **Fase 1 (este MVP):** Dashboard, empresas, tarefas, entregáveis com Kanban e quantidades, percentual automático, controle mensal, histórico, alertas de prazo e ritmo.
- **Fase 2 (estrutura pronta):** integração de leitura com o Pipedrive (funil SOBE), com espelho local dos negócios.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Radix UI · Drizzle ORM · PostgreSQL (Supabase) · Vercel

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha as variáveis
npm run db:migrate     # aplica as migrações no banco
npm run db:seed        # (opcional) dados iniciais: GRID CO, ORKA, SOBE + exemplos
npm run dev
```

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Connection string do Postgres (Supabase: use o **Transaction pooler**, porta 6543) |
| `AUTH_SECRET` | Segredo do JWT de sessão (`openssl rand -base64 32`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Credenciais do único usuário |
| `PIPEDRIVE_API_TOKEN` / `PIPEDRIVE_COMPANY_DOMAIN` | Fase 2 — deixar vazio por enquanto |

## Deploy (Supabase + Vercel)

### 1. Banco no Supabase (~5 min)

1. Crie um projeto em [supabase.com](https://supabase.com) (região `sa-east-1` / São Paulo).
2. Em **Project Settings → Database**, copie a connection string do **Transaction pooler** (`...pooler.supabase.com:6543/postgres`) e troque `[YOUR-PASSWORD]` pela senha do projeto.
3. No seu computador (ou em qualquer terminal com o repo clonado):
   ```bash
   DATABASE_URL="<connection string>" npm run db:migrate
   DATABASE_URL="<connection string>" npm run db:seed
   ```

### 2. App na Vercel (~5 min)

1. Em [vercel.com/new](https://vercel.com/new), importe este repositório do GitHub.
2. Em **Environment Variables**, adicione: `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
3. Deploy. Pronto — acesse a URL gerada e faça login.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Ambiente de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run db:generate` | Gera migração a partir de mudanças no schema (`src/lib/db/schema.ts`) |
| `npm run db:migrate` | Aplica migrações pendentes |
| `npm run db:seed` | Popula dados iniciais |

## Estrutura

```
src/
├── app/
│   ├── (app)/            # páginas autenticadas (dashboard, entregas, tarefas…)
│   └── login/
├── components/           # UI + Kanban + formulários
└── lib/
    ├── db/               # schema Drizzle, conexão e seed
    ├── actions/          # server actions (CRUD)
    ├── alerts.ts         # alertas e cálculo de ritmo (só dados reais)
    ├── queries.ts        # consultas
    └── format.ts         # datas/moeda pt-BR (fuso America/Sao_Paulo)
```
