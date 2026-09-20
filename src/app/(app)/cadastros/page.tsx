import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryManager } from "@/components/category-manager";
import { CompanyFormDialog } from "@/components/company-form";
import { getAllCompanies, getCategories } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function CadastrosPage() {
  const [companies, categories] = await Promise.all([
    getAllCompanies(),
    getCategories(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Cadastros</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Empresas e categorias de entrega
        </p>
      </header>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Empresas</CardTitle>
          <CompanyFormDialog />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {companies.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                style={{ backgroundColor: c.color }}
              >
                {c.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{c.name}</p>
                {c.description && (
                  <p className="truncate text-xs text-ink-muted">
                    {c.description}
                  </p>
                )}
              </div>
              {c.hasDeliverables && <Badge tone="primary">Entregáveis</Badge>}
              <Badge tone={c.isActive ? "success" : "default"}>
                {c.isActive ? "Ativa" : "Inativa"}
              </Badge>
              <CompanyFormDialog initial={c} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categorias de entrega</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryManager categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
