import { NotFoundError, ValidationError } from '../errors.ts';
import type { TaskOrdering } from '../services/TaskOrdering.ts';
import { Task, type TaskSnapshot } from './Task.ts';
import { clampPosition, hexColor, optionalPositiveInt, requireText } from './validation.ts';

export const COLUMN_LIMITS = { name: 40, wipLimit: 99 } as const;
export const DEFAULT_COLUMN_COLOR = '#64748b';

export interface ColumnSnapshot {
  id: string;
  name: string;
  color: string;
  /** Límite de trabajo en curso (WIP). null = sin límite. */
  wipLimit: number | null;
  tasks: TaskSnapshot[];
}

export interface NewColumnData {
  name: unknown;
  color?: unknown;
  wipLimit?: unknown;
}

export type ColumnChanges = Partial<NewColumnData>;

/** Columna del tablero: contiene una lista ordenada de tareas. */
export class Column {
  readonly id: string;
  #name: string;
  #color: string;
  #wipLimit: number | null;
  #tasks: Task[];

  private constructor(id: string, name: string, color: string, wipLimit: number | null, tasks: Task[]) {
    this.id = id;
    this.#name = name;
    this.#color = color;
    this.#wipLimit = wipLimit;
    this.#tasks = tasks;
  }

  static create(id: string, data: NewColumnData): Column {
    return new Column(
      id,
      requireText(data.name, 'nombre', COLUMN_LIMITS.name),
      hexColor(data.color, DEFAULT_COLUMN_COLOR),
      optionalPositiveInt(data.wipLimit, 'límite WIP', COLUMN_LIMITS.wipLimit),
      [],
    );
  }

  static fromSnapshot(snapshot: ColumnSnapshot): Column {
    if (typeof snapshot?.id !== 'string' || snapshot.id.length === 0) {
      throw new ValidationError('Columna persistida sin id');
    }
    const column = Column.create(snapshot.id, snapshot);
    const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
    column.#tasks = tasks.map((task) => Task.fromSnapshot(task));
    return column;
  }

  get name(): string {
    return this.#name;
  }

  get taskCount(): number {
    return this.#tasks.length;
  }

  update(changes: ColumnChanges): void {
    const name = 'name' in changes ? requireText(changes.name, 'nombre', COLUMN_LIMITS.name) : this.#name;
    const color = 'color' in changes ? hexColor(changes.color, this.#color) : this.#color;
    const wipLimit =
      'wipLimit' in changes
        ? optionalPositiveInt(changes.wipLimit, 'límite WIP', COLUMN_LIMITS.wipLimit)
        : this.#wipLimit;
    this.#name = name;
    this.#color = color;
    this.#wipLimit = wipLimit;
  }

  hasTask(taskId: string): boolean {
    return this.#tasks.some((task) => task.id === taskId);
  }

  getTask(taskId: string): Task {
    const task = this.#tasks.find((t) => t.id === taskId);
    if (!task) throw new NotFoundError(`No existe la tarea ${taskId}`);
    return task;
  }

  /** Inserta una tarea en la posición indicada (por defecto, al final). */
  insertTask(task: Task, position?: number): void {
    this.#tasks.splice(clampPosition(position, this.#tasks.length), 0, task);
  }

  removeTask(taskId: string): Task {
    const index = this.#tasks.findIndex((t) => t.id === taskId);
    if (index === -1) throw new NotFoundError(`No existe la tarea ${taskId}`);
    const [removed] = this.#tasks.splice(index, 1);
    return removed as Task;
  }

  /** Quita y devuelve todas las tareas (útil al eliminar la columna). */
  drainTasks(): Task[] {
    const tasks = this.#tasks;
    this.#tasks = [];
    return tasks;
  }

  sortTasks(ordering: TaskOrdering): void {
    this.#tasks.sort((a, b) => ordering.compare(a, b));
  }

  isOverWipLimit(): boolean {
    return this.#wipLimit !== null && this.#tasks.length > this.#wipLimit;
  }

  toSnapshot(): ColumnSnapshot {
    return {
      id: this.id,
      name: this.#name,
      color: this.#color,
      wipLimit: this.#wipLimit,
      tasks: this.#tasks.map((task) => task.toSnapshot()),
    };
  }
}
