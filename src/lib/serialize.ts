import type { Category, Company, Deliverable, Task } from "@/lib/db/schema";
import { effectiveStatus } from "@/lib/alerts";
import type { DeliverableCardData } from "@/components/deliverables-kanban";
import type { TaskItemData } from "@/components/task-item";

export function toDeliverableCard(
  d: Deliverable & { company: Company; category?: Category | null }
): DeliverableCardData {
  return {
    id: d.id,
    companyId: d.companyId,
    categoryId: d.categoryId,
    title: d.title,
    description: d.description,
    monthRef: d.monthRef,
    plannedQty: d.plannedQty,
    deliveredQty: d.deliveredQty,
    deadline: d.deadline,
    status: d.status,
    effectiveStatus: effectiveStatus(d),
    owner: d.owner,
    notes: d.notes,
    companyName: d.company.name,
    companyColor: d.company.color,
    categoryName: d.category?.name ?? null,
  };
}

export function toTaskItem(
  t: Task & { company?: Company | null }
): TaskItemData {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    companyId: t.companyId,
    dueDate: t.dueDate,
    priority: t.priority,
    status: t.status,
    companyName: t.company?.name ?? null,
    companyColor: t.company?.color ?? null,
  };
}
