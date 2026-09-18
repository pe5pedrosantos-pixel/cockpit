export const DELIVERABLE_STATUS_LABEL: Record<string, string> = {
  PLANEJADO: "Planejado",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
  ATRASADO: "Atrasado",
};

export const TASK_STATUS_LABEL: Record<string, string> = {
  A_FAZER: "A fazer",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
};

export const PRIORITY_LABEL: Record<string, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

export const PRIORITY_TONE: Record<
  string,
  "default" | "primary" | "warning" | "danger"
> = {
  BAIXA: "default",
  MEDIA: "primary",
  ALTA: "warning",
  URGENTE: "danger",
};
