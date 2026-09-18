import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { Sidebar } from "@/components/sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const list = await db
    .select({
      name: companies.name,
      slug: companies.slug,
      color: companies.color,
    })
    .from(companies)
    .where(eq(companies.isActive, true))
    .orderBy(asc(companies.name));

  const withDeliverables = await db
    .select({ slug: companies.slug })
    .from(companies)
    .where(eq(companies.hasDeliverables, true));
  const dSlugs = new Set(withDeliverables.map((c) => c.slug));

  return (
    <div className="min-h-screen">
      <Sidebar companies={list.filter((c) => dSlugs.has(c.slug))} />
      <main className="md:pl-60">
        <div className="mx-auto max-w-6xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
