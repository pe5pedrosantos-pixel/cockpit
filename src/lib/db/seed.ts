/* Seed inicial: empresas, categorias e dados de exemplo (setembro/2026). */
import { db } from "./index";
import {
  categories,
  companies,
  deliverables,
  integrations,
  tasks,
  users,
} from "./schema";

async function main() {
  console.log("→ Seed: usuários");
  await db
    .insert(users)
    .values({ email: "pe5pedrosantos@gmail.com", name: "Pedro Santos" })
    .onConflictDoNothing();

  console.log("→ Seed: empresas");
  const [gridco, orka, sobe] = await db
    .insert(companies)
    .values([
      {
        name: "GRID CO",
        slug: "grid-co",
        color: "#f59e0b",
        description: "Marketing e social media — O&M solar",
        hasDeliverables: true,
      },
      {
        name: "ORKA",
        slug: "orka",
        color: "#0ea5e9",
        description: "Marketing — Energy Asset Management",
        hasDeliverables: true,
      },
      {
        name: "SOBE",
        slug: "sobe",
        color: "#8b5cf6",
        description: "Agência — comercial via Pipedrive",
        hasDeliverables: false,
      },
    ])
    .onConflictDoNothing()
    .returning();

  console.log("→ Seed: categorias");
  await db
    .insert(categories)
    .values([
      { name: "Social Media", color: "#ec4899" },
      { name: "Design", color: "#f97316" },
      { name: "Vídeo", color: "#ef4444" },
      { name: "Performance", color: "#22c55e" },
      { name: "Estratégia", color: "#6366f1" },
      { name: "Comercial", color: "#8b5cf6" },
      { name: "Administrativo", color: "#64748b" },
      { name: "Outros", color: "#94a3b8" },
    ])
    .onConflictDoNothing();

  if (!gridco || !orka || !sobe) {
    console.log("Empresas já existiam — pulando dados de exemplo.");
    return;
  }

  const cats = await db.select().from(categories);
  const cat = (name: string) => cats.find((c) => c.name === name)?.id ?? null;

  console.log("→ Seed: entregáveis de exemplo (setembro/2026)");
  await db.insert(deliverables).values([
    {
      companyId: gridco.id,
      categoryId: cat("Design"),
      title: "Artes para redes sociais",
      monthRef: "2026-09",
      plannedQty: 8,
      deliveredQty: 4,
      deadline: "2026-09-30",
      status: "EM_ANDAMENTO",
    },
    {
      companyId: gridco.id,
      categoryId: cat("Vídeo"),
      title: "Vídeos institucionais",
      monthRef: "2026-09",
      plannedQty: 3,
      deliveredQty: 3,
      deadline: "2026-09-25",
      status: "CONCLUIDO",
    },
    {
      companyId: gridco.id,
      categoryId: cat("Estratégia"),
      title: "Relatórios de performance",
      monthRef: "2026-09",
      plannedQty: 2,
      deliveredQty: 2,
      deadline: "2026-09-15",
      status: "CONCLUIDO",
    },
    {
      companyId: orka.id,
      categoryId: cat("Social Media"),
      title: "Posts para Instagram",
      monthRef: "2026-09",
      plannedQty: 12,
      deliveredQty: 8,
      deadline: "2026-09-30",
      status: "EM_ANDAMENTO",
    },
    {
      companyId: orka.id,
      categoryId: cat("Design"),
      title: "Apresentação segmentada — usinas",
      monthRef: "2026-09",
      plannedQty: 1,
      deliveredQty: 0,
      deadline: "2026-09-22",
      status: "PLANEJADO",
    },
    // histórico (agosto)
    {
      companyId: gridco.id,
      categoryId: cat("Design"),
      title: "Artes para redes sociais",
      monthRef: "2026-08",
      plannedQty: 12,
      deliveredQty: 12,
      deadline: "2026-08-31",
      status: "CONCLUIDO",
    },
    {
      companyId: orka.id,
      categoryId: cat("Social Media"),
      title: "Posts para Instagram",
      monthRef: "2026-08",
      plannedQty: 10,
      deliveredQty: 9,
      deadline: "2026-08-31",
      status: "CONCLUIDO",
    },
  ]);

  console.log("→ Seed: tarefas de exemplo");
  await db.insert(tasks).values([
    {
      title: "Finalizar arte do post — Grid Co",
      companyId: gridco.id,
      dueDate: "2026-09-18",
      priority: "ALTA",
      status: "EM_ANDAMENTO",
    },
    {
      title: "Revisar material da Orka",
      companyId: orka.id,
      dueDate: "2026-09-18",
      priority: "MEDIA",
      status: "A_FAZER",
    },
    {
      title: "Follow-up proposta — cliente agro",
      companyId: sobe.id,
      dueDate: "2026-09-17",
      priority: "URGENTE",
      status: "A_FAZER",
    },
    {
      title: "Planejar pauta de outubro — Grid Co",
      companyId: gridco.id,
      dueDate: "2026-09-24",
      priority: "BAIXA",
      status: "A_FAZER",
    },
  ]);

  console.log("→ Seed: integrações");
  await db
    .insert(integrations)
    .values({ provider: "pipedrive", status: "disconnected" })
    .onConflictDoNothing();

  console.log("✓ Seed concluído.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
