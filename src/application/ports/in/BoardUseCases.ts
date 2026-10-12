import type { BoardSnapshot } from '../../../domain/model/Board.ts';

/**
 * Puertos de entrada (driving ports). Los adaptadores de entrada (HTTP, CLI,
 * tests...) dependen de estas interfaces, nunca de las clases concretas.
 * Cada caso de uso tiene una única responsabilidad y un único método.
 */
export interface UseCase<Input, Output> {
  execute(input: Input): Promise<Output>;
}

/** Modelo de lectura que devuelven los casos de uso. */
export type BoardView = BoardSnapshot;

// ----- Comandos -----

export interface CreateColumnCommand {
  name: unknown;
  color?: unknown;
  wipLimit?: unknown;
  position?: number;
}

export interface UpdateColumnCommand {
  columnId: string;
  changes: { name?: unknown; color?: unknown; wipLimit?: unknown };
}

export interface DeleteColumnCommand {
  columnId: string;
  /** Columna destino para las tareas; si se omite, se eliminan. */
  moveTasksTo?: string | null;
}

export interface MoveColumnCommand {
  columnId: string;
  position: number;
}

export interface SortColumnCommand {
  columnId: string;
  by: string;
}

export interface CreateTaskCommand {
  columnId: string;
  title: unknown;
  description?: unknown;
  priority?: unknown;
  dueDate?: unknown;
  tags?: unknown;
  position?: number;
}

export interface UpdateTaskCommand {
  taskId: string;
  changes: { title?: unknown; description?: unknown; priority?: unknown; dueDate?: unknown; tags?: unknown };
}

export interface MoveTaskCommand {
  taskId: string;
  toColumnId: string;
  position?: number;
}

export interface DeleteTaskCommand {
  taskId: string;
}

// ----- Puertos -----

export type InitializeBoardUseCase = UseCase<void, BoardView>;
export type GetBoardUseCase = UseCase<void, BoardView>;
export type CreateColumnUseCase = UseCase<CreateColumnCommand, BoardView>;
export type UpdateColumnUseCase = UseCase<UpdateColumnCommand, BoardView>;
export type DeleteColumnUseCase = UseCase<DeleteColumnCommand, BoardView>;
export type MoveColumnUseCase = UseCase<MoveColumnCommand, BoardView>;
export type SortColumnUseCase = UseCase<SortColumnCommand, BoardView>;
export type CreateTaskUseCase = UseCase<CreateTaskCommand, BoardView>;
export type UpdateTaskUseCase = UseCase<UpdateTaskCommand, BoardView>;
export type MoveTaskUseCase = UseCase<MoveTaskCommand, BoardView>;
export type DeleteTaskUseCase = UseCase<DeleteTaskCommand, BoardView>;

/** Conjunto de casos de uso que consume el adaptador HTTP. */
export interface BoardUseCases {
  getBoard: GetBoardUseCase;
  createColumn: CreateColumnUseCase;
  updateColumn: UpdateColumnUseCase;
  deleteColumn: DeleteColumnUseCase;
  moveColumn: MoveColumnUseCase;
  sortColumn: SortColumnUseCase;
  createTask: CreateTaskUseCase;
  updateTask: UpdateTaskUseCase;
  moveTask: MoveTaskUseCase;
  deleteTask: DeleteTaskUseCase;
}
