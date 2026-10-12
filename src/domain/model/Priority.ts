import { ValidationError } from '../errors.ts';

/** Niveles de prioridad, de menor a mayor. */
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export type Priority = (typeof PRIORITIES)[number];

export const DEFAULT_PRIORITY: Priority = 'medium';

const WEIGHTS: Record<Priority, number> = { low: 1, medium: 2, high: 3, urgent: 4 };

export function isPriority(value: unknown): value is Priority {
  return typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value);
}

export function parsePriority(value: unknown): Priority {
  if (value === undefined || value === null) return DEFAULT_PRIORITY;
  if (!isPriority(value)) {
    throw new ValidationError(`Prioridad inválida. Valores permitidos: ${PRIORITIES.join(', ')}`);
  }
  return value;
}

/** Peso numérico: a mayor peso, más importante. */
export function priorityWeight(priority: Priority): number {
  return WEIGHTS[priority];
}
