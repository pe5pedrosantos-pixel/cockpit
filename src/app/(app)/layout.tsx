import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { Sidebar } from "@/components/sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // uma única consulta para montar a navegação
  const list = await db
    .select({
      name: companies.name,
      slug: companies.slug,
      color: companies.color,
    })
    .from(companies)
    .where(
      and(eq(companies.isActive, true), eq(companies.hasDeliverables, true))
    )
    .orderBy(asc(companies.name));

  return (
    <div className="min-h-screen">
      <Sidebar companies={list} />
      <main className="md:pl-60">
        <div className="mx-auto max-w-5xl px-5 py-7 md:px-10 md:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
