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
| `MCP_SECRET` | Senha do conector do Claude (aba Social Media). Mínimo 24 caracteres: `openssl rand -hex 24` |
| `ANTHROPIC_API_KEY` | Opcional. Liga o Claude dentro da aba Social Media (ideias, legendas, análises) |
| `ANTHROPIC_MODEL` | Opcional. Modelo da API da Anthropic (padrão: `claude-sonnet-5-5`) |
| `BLOB_READ_WRITE_TOKEN` | Criada pela Vercel ao conectar um Blob store ao projeto (Storage → Create → Blob). Guarda artes, vídeos e PDFs dos posts |

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

## Social Media (marca Pedro Santos)

Aba `/social`: calendário, fila de aprovação, solicitações nos dois sentidos, linhas editoriais, analytics, histórico e conexões.

- **Primeira vez:** abra a aba e clique em **Preparar banco** (cria as tabelas `sm_*` e as linhas padrão). O mesmo SQL está em `drizzle/0007_social_media.sql` e é idempotente, então `npm run db:migrate` também funciona, antes ou depois.
- **Claude → Cockpit:** conector MCP em `/api/mcp/<MCP_SECRET>` (Streamable HTTP, sem sessão). O endereço completo aparece na aba **Conexões**; adicione no claude.ai em Configurações → Conectores → Adicionar conector personalizado. Quem não tem o segredo recebe 404. O segredo vai no caminho porque conectores sem OAuth não mandam cabeçalho; ele pode aparecer nos logs da Vercel, que só você acessa.
- **Cockpit → Claude:** com `ANTHROPIC_API_KEY`, os botões "com o Claude" chamam a API da Anthropic (cobrança por uso, à parte do plano do claude.ai). Arte, vídeo, agendamento no Metricool e métricas viram solicitações para o agente, que executa com os conectores dele (o Metricool Starter não tem API).
- **Artes e vídeos:** cada post tem uma galeria (carrossel, vídeo, PDF) guardada no Vercel Blob. O Pedro sobe arquivos direto do navegador (`/api/social/upload`, sem passar pelo limite das funções); o agente usa a ferramenta `anexar_midias` com links do Canva, Higgsfield ou Metricool e o cockpit guarda a cópia. A tabela `sm_media` (migração 0008) é criada sozinha na primeira abertura da aba depois do deploy.
- Código: `src/lib/social/` (regras, esquemas, servidor MCP e chamadas à API), `src/lib/actions/social.ts` e `src/components/social/`.

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
    ├── social/           # aba Social Media: regras, conector MCP, Claude via API
    ├── alerts.ts         # alertas e cálculo de ritmo (só dados reais)
    ├── queries.ts        # consultas
    └── format.ts         # datas/moeda pt-BR (fuso America/Sao_Paulo)
```
