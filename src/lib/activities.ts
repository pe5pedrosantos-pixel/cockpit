/**
 * Datas de atividade do Pipedrive.
 *
 * O Pipedrive guarda due_date + due_time em UTC. Atividades sem horário
 * ("no dia") vêm só com a data, que não deve ser convertida de fuso.
 * No sync gravamos due_at como UTC (T00:00 quando não há hora) e marcamos
 * has_time para saber qual das duas leituras usar.
 */

const TZ = "America/Sao_Paulo";
/** São Paulo não tem horário de verão desde 2019. */
const SP_OFFSET = "-03:00";

/** Dia da atividade (YYYY-MM-DD) no calendário de São Paulo. */
export function activityDay(dueAt: Date | string, hasTime: boolean): string {
  const d = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  if (!hasTime) return d.toISOString().slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Horário local ("14:30") ou null quando é "no dia". */
export function activityTime(dueAt: Date | string, hasTime: boolean): string | null {
  if (!hasTime) return null;
  const d = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Data e hora digitadas no cockpit (horário de São Paulo) → o par
 * due_date / due_time em UTC que o Pipedrive espera.
 */
export function toPipedriveDue(
  localDate: string,
  localTime?: string | null
): { due_date: string; due_time: string | null } {
  if (!localTime) return { due_date: localDate, due_time: null };
  const d = new Date(`${localDate}T${localTime}:00${SP_OFFSET}`);
  const iso = d.toISOString();
  return { due_date: iso.slice(0, 10), due_time: iso.slice(11, 16) };
}

/** Rótulo curto de quando: "Hoje, 14:30", "Atrasada desde 12/09"… */
export function activityWhen(day: string, time: string | null, today: string): string {
  const [, m, d] = day.split("-");
  const short = `${d}/${m}`;
  if (day === today) return time ? `Hoje, ${time}` : "Hoje";
  if (day < today) return `Atrasada desde ${short}`;
  return time ? `${short}, ${time}` : short;
}

export interface ActivityRowData {
  id: number;
  pipedriveId: number | null;
  subject: string;
  type: string | null;
  note: string | null;
  day: string | null;
  time: string | null;
  done: boolean;
  overdue: boolean;
  dealTitle: string | null;
  orgName: string | null;
}
