import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TaskFormDialog } from "@/components/task-form";
import { TaskItem } from "@/components/task-item";
import { TasksKanban } from "@/components/tasks-kanban";
import { getActiveCompanies, getTasks } from "@/lib/queries";
import { todayISO } from "@/lib/format";
import { toTaskItem } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function TarefasPage() {
  const [allTasks, companies] = await Promise.all([
    getTasks(),
    getActiveCompanies(),
  ]);
  const items = allTasks.map(toTaskItem);
  const today = todayISO();
  const companyOptions = companies.map((c) => ({ id: c.id, name: c.name }));

  const open = items.filter((t) => t.status !== "CONCLUIDA");
  const views = {
    hoje: open.filter((t) => t.dueDate === today),
    atrasadas: open.filter((t) => t.dueDate && t.dueDate < today),
    proximas: open.filter((t) => !t.dueDate || t.dueDate > today),
    concluidas: items.filter((t) => t.status === "CONCLUIDA"),
  };

  const listOf = (list: typeof items, empty: string) => (
    <div className="flex flex-col gap-2">
      {list.length === 0 && (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
      {list.map((t) => (
        <TaskItem key={t.id} task={t} companies={companyOptions} />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tarefas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {open.length} abertas · {views.atrasadas.length} atrasadas
          </p>
        </div>
        <TaskFormDialog companies={companyOptions} />
      </header>

      <Tabs defaultValue="hoje">
        <TabsList>
          <TabsTrigger value="hoje">
            Hoje{" "}
            {views.hoje.length > 0 && (
              <Badge tone="primary" className="ml-1.5">
                {views.hoje.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="atrasadas">
            Atrasadas{" "}
            {views.atrasadas.length > 0 && (
              <Badge tone="danger" className="ml-1.5">
                {views.atrasadas.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="proximas">Próximas</TabsTrigger>
          <TabsTrigger value="concluidas">Concluídas</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
        </TabsList>

        <TabsContent value="hoje">
          {listOf(views.hoje, "Nenhuma tarefa para hoje. 🎉")}
        </TabsContent>
        <TabsContent value="atrasadas">
          {listOf(views.atrasadas, "Nenhuma tarefa atrasada. 🟢")}
        </TabsContent>
        <TabsContent value="proximas">
          {listOf(views.proximas, "Nenhuma tarefa futura.")}
        </TabsContent>
        <TabsContent value="concluidas">
          {listOf(views.concluidas, "Nenhuma tarefa concluída ainda.")}
        </TabsContent>
        <TabsContent value="kanban">
          <TasksKanban tasks={items} companies={companyOptions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
