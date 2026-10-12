import { parsePriority, type Priority } from './Priority.ts';
import { optionalIsoDate, optionalText, requireText, tagList } from './validation.ts';
import { ValidationError } from '../errors.ts';

export const TASK_LIMITS = {
  title: 120,
  description: 2000,
  tags: 8,
  tagLength: 24,
} as const;

/** Representación plana y serializable de una tarea. */
export interface TaskSnapshot {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  dueDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** Datos para crear una tarea. Solo el título es obligatorio. */
export interface NewTaskData {
  title: unknown;
  description?: unknown;
  priority?: unknown;
  dueDate?: unknown;
  tags?: unknown;
}

/** Cambios parciales: solo se modifican las propiedades presentes. */
export type TaskChanges = Partial<NewTaskData>;

/**
 * Entidad Tarea. Protege sus invariantes: cualquier instancia existente
 * tiene un título válido, una prioridad conocida, etc.
 */
export class Task {
  #state: TaskSnapshot;

  private constructor(state: TaskSnapshot) {
    this.#state = state;
  }

  static create(id: string, data: NewTaskData, now: Date): Task {
    const timestamp = now.toISOString();
    return new Task({
      id,
      title: requireText(data.title, 'título', TASK_LIMITS.title),
      description: optionalText(data.description, 'descripción', TASK_LIMITS.description),
      priority: parsePriority(data.priority),
      dueDate: optionalIsoDate(data.dueDate, 'fecha límite'),
      tags: tagList(data.tags, TASK_LIMITS.tags, TASK_LIMITS.tagLength),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  /** Reconstruye una tarea persistida, validándola de nuevo. */
  static fromSnapshot(snapshot: TaskSnapshot): Task {
    if (typeof snapshot?.id !== 'string' || snapshot.id.length === 0) {
      throw new ValidationError('Tarea persistida sin id');
    }
    const createdAt = new Date(snapshot.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      throw new ValidationError(`La tarea ${snapshot.id} tiene una fecha de creación inválida`);
    }
    const task = Task.create(snapshot.id, snapshot, createdAt);
    task.#state.updatedAt = snapshot.updatedAt ?? task.#state.createdAt;
    return task;
  }

  get id(): string {
    return this.#state.id;
  }
  get title(): string {
    return this.#state.title;
  }
  get priority(): Priority {
    return this.#state.priority;
  }
  get dueDate(): string | null {
    return this.#state.dueDate;
  }
  get createdAt(): string {
    return this.#state.createdAt;
  }

  update(changes: TaskChanges, now: Date): void {
    const next = { ...this.#state };
    if ('title' in changes) next.title = requireText(changes.title, 'título', TASK_LIMITS.title);
    if ('description' in changes) {
      next.description = optionalText(changes.description, 'descripción', TASK_LIMITS.description);
    }
    if ('priority' in changes) next.priority = parsePriority(changes.priority);
    if ('dueDate' in changes) next.dueDate = optionalIsoDate(changes.dueDate, 'fecha límite');
    if ('tags' in changes) next.tags = tagList(changes.tags, TASK_LIMITS.tags, TASK_LIMITS.tagLength);
    next.updatedAt = now.toISOString();
    this.#state = next; // se asigna solo si todo fue válido (cambio atómico)
  }

  toSnapshot(): TaskSnapshot {
    return { ...this.#state, tags: [...this.#state.tags] };
  }
}
