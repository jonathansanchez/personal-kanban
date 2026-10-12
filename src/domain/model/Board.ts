import { NotFoundError, ValidationError } from '../errors.ts';
import type { TaskOrdering } from '../services/TaskOrdering.ts';
import { Column, type ColumnChanges, type ColumnSnapshot } from './Column.ts';
import type { Task, TaskChanges } from './Task.ts';
import { clampPosition, requireText } from './validation.ts';

export const BOARD_LIMITS = { title: 60, columns: 20 } as const;
export const BOARD_SCHEMA_VERSION = 1;

export interface BoardSnapshot {
  version: number;
  title: string;
  updatedAt: string;
  columns: ColumnSnapshot[];
}

/** Dónde se encuentra una tarea dentro del tablero. */
export interface TaskLocation {
  column: Column;
  task: Task;
}

/**
 * Raíz de agregado. Todas las modificaciones de columnas y tareas pasan por
 * el tablero, que garantiza las reglas que involucran a varias columnas
 * (nombres únicos, mover tareas entre columnas, etc.).
 */
export class Board {
  #title: string;
  #updatedAt: string;
  #columns: Column[];

  private constructor(title: string, updatedAt: string, columns: Column[]) {
    this.#title = title;
    this.#updatedAt = updatedAt;
    this.#columns = columns;
  }

  static create(title: unknown, now: Date): Board {
    return new Board(requireText(title, 'título del tablero', BOARD_LIMITS.title), now.toISOString(), []);
  }

  static fromSnapshot(snapshot: BoardSnapshot): Board {
    if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.columns)) {
      throw new ValidationError('El tablero persistido tiene un formato inválido');
    }
    const board = new Board(
      requireText(snapshot.title, 'título del tablero', BOARD_LIMITS.title),
      typeof snapshot.updatedAt === 'string' ? snapshot.updatedAt : new Date(0).toISOString(),
      snapshot.columns.map((c) => Column.fromSnapshot(c)),
    );
    board.#assertUniqueIds();
    return board;
  }

  get title(): string {
    return this.#title;
  }

  get columnCount(): number {
    return this.#columns.length;
  }

  // ---------- Columnas ----------

  addColumn(column: Column, position?: number): void {
    if (this.#columns.length >= BOARD_LIMITS.columns) {
      throw new ValidationError(`El tablero admite como máximo ${BOARD_LIMITS.columns} columnas`);
    }
    this.#assertNameAvailable(column.name);
    this.#columns.splice(clampPosition(position, this.#columns.length), 0, column);
  }

  getColumn(columnId: string): Column {
    const column = this.#columns.find((c) => c.id === columnId);
    if (!column) throw new NotFoundError(`No existe la columna ${columnId}`);
    return column;
  }

  updateColumn(columnId: string, changes: ColumnChanges): void {
    const column = this.getColumn(columnId);
    if ('name' in changes && typeof changes.name === 'string') {
      this.#assertNameAvailable(changes.name, columnId);
    }
    column.update(changes);
  }

  /**
   * Elimina una columna. Si se indica `moveTasksTo`, sus tareas pasan al final
   * de esa columna; si no, se eliminan junto con ella.
   */
  removeColumn(columnId: string, moveTasksTo?: string | null): void {
    const column = this.getColumn(columnId);
    let target: Column | null = null;
    if (moveTasksTo) {
      if (moveTasksTo === columnId) {
        throw new ValidationError('No se pueden mover las tareas a la misma columna que se elimina');
      }
      target = this.getColumn(moveTasksTo);
    }
    for (const task of column.drainTasks()) target?.insertTask(task);
    this.#columns = this.#columns.filter((c) => c.id !== columnId);
  }

  moveColumn(columnId: string, position: number): void {
    const column = this.getColumn(columnId);
    this.#columns = this.#columns.filter((c) => c.id !== columnId);
    this.#columns.splice(clampPosition(position, this.#columns.length), 0, column);
  }

  sortColumn(columnId: string, ordering: TaskOrdering): void {
    this.getColumn(columnId).sortTasks(ordering);
  }

  // ---------- Tareas ----------

  addTask(columnId: string, task: Task, position?: number): void {
    if (this.#findTaskLocation(task.id)) {
      throw new ValidationError(`Ya existe una tarea con id ${task.id}`);
    }
    this.getColumn(columnId).insertTask(task, position);
  }

  locateTask(taskId: string): TaskLocation {
    const location = this.#findTaskLocation(taskId);
    if (!location) throw new NotFoundError(`No existe la tarea ${taskId}`);
    return location;
  }

  updateTask(taskId: string, changes: TaskChanges, now: Date): void {
    this.locateTask(taskId).task.update(changes, now);
  }

  /** Mueve una tarea a otra columna (o a otra posición de la misma). */
  moveTask(taskId: string, targetColumnId: string, position?: number): void {
    const target = this.getColumn(targetColumnId); // validar antes de modificar nada
    const { column } = this.locateTask(taskId);
    const task = column.removeTask(taskId);
    target.insertTask(task, position);
  }

  removeTask(taskId: string): void {
    this.locateTask(taskId).column.removeTask(taskId);
  }

  // ---------- Otros ----------

  touch(now: Date): void {
    this.#updatedAt = now.toISOString();
  }

  toSnapshot(): BoardSnapshot {
    return {
      version: BOARD_SCHEMA_VERSION,
      title: this.#title,
      updatedAt: this.#updatedAt,
      columns: this.#columns.map((c) => c.toSnapshot()),
    };
  }

  #findTaskLocation(taskId: string): TaskLocation | null {
    for (const column of this.#columns) {
      if (column.hasTask(taskId)) return { column, task: column.getTask(taskId) };
    }
    return null;
  }

  #assertNameAvailable(name: string, exceptColumnId?: string): void {
    const normalized = name.trim().toLocaleLowerCase();
    const taken = this.#columns.some(
      (c) => c.id !== exceptColumnId && c.name.toLocaleLowerCase() === normalized,
    );
    if (taken) throw new ValidationError(`Ya existe una columna llamada "${name.trim()}"`);
  }

  #assertUniqueIds(): void {
    const ids = new Set<string>();
    for (const column of this.toSnapshot().columns) {
      for (const id of [column.id, ...column.tasks.map((t) => t.id)]) {
        if (ids.has(id)) throw new ValidationError(`Id duplicado en el tablero persistido: ${id}`);
        ids.add(id);
      }
    }
  }
}
