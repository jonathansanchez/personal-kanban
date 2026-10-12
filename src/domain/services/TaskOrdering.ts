import { priorityWeight } from '../model/Priority.ts';
import type { Task } from '../model/Task.ts';

/**
 * Estrategia de ordenamiento de tareas dentro de una columna.
 * Principio Abierto/Cerrado: para un nuevo criterio se agrega una clase,
 * sin modificar Column, Board ni los casos de uso.
 */
export interface TaskOrdering {
  readonly key: string;
  compare(a: Task, b: Task): number;
}

function byDueDate(a: Task, b: Task): number {
  if (a.dueDate === b.dueDate) return 0;
  if (a.dueDate === null) return 1; // sin fecha al final
  if (b.dueDate === null) return -1;
  return a.dueDate < b.dueDate ? -1 : 1;
}

function byPriorityDesc(a: Task, b: Task): number {
  return priorityWeight(b.priority) - priorityWeight(a.priority);
}

function byCreatedAt(a: Task, b: Task): number {
  return a.createdAt.localeCompare(b.createdAt);
}

/** Primero lo más prioritario; a igual prioridad, lo que vence antes. */
export class PriorityOrdering implements TaskOrdering {
  readonly key = 'priority';
  compare(a: Task, b: Task): number {
    return byPriorityDesc(a, b) || byDueDate(a, b) || byCreatedAt(a, b);
  }
}

/** Primero lo que vence antes; a igual fecha, lo más prioritario. */
export class DueDateOrdering implements TaskOrdering {
  readonly key = 'dueDate';
  compare(a: Task, b: Task): number {
    return byDueDate(a, b) || byPriorityDesc(a, b) || byCreatedAt(a, b);
  }
}
