import { ValidationError } from '../../domain/errors.ts';
import { Column } from '../../domain/model/Column.ts';
import type { TaskOrdering } from '../../domain/services/TaskOrdering.ts';
import type {
  BoardView,
  CreateColumnCommand,
  CreateColumnUseCase,
  DeleteColumnCommand,
  DeleteColumnUseCase,
  MoveColumnCommand,
  MoveColumnUseCase,
  SortColumnCommand,
  SortColumnUseCase,
  UpdateColumnCommand,
  UpdateColumnUseCase,
} from '../ports/in/BoardUseCases.ts';
import type { BoardRepository } from '../ports/out/BoardRepository.ts';
import type { Clock } from '../ports/out/Clock.ts';
import type { IdGenerator } from '../ports/out/IdGenerator.ts';
import { mutateBoard } from './shared.ts';

/*
 * Un caso de uso = una clase con una sola responsabilidad (SRP).
 * Todas dependen de puertos (interfaces), no de implementaciones (DIP).
 */

export class CreateColumn implements CreateColumnUseCase {
  private readonly repository: BoardRepository;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  constructor(repository: BoardRepository, ids: IdGenerator, clock: Clock) {
    this.repository = repository;
    this.ids = ids;
    this.clock = clock;
  }

  execute(command: CreateColumnCommand): Promise<BoardView> {
    return mutateBoard(this.repository, this.clock, (board) => {
      board.addColumn(Column.create(this.ids.next(), command), command.position);
    });
  }
}

export class UpdateColumn implements UpdateColumnUseCase {
  private readonly repository: BoardRepository;
  private readonly clock: Clock;

  constructor(repository: BoardRepository, clock: Clock) {
    this.repository = repository;
    this.clock = clock;
  }

  execute(command: UpdateColumnCommand): Promise<BoardView> {
    return mutateBoard(this.repository, this.clock, (board) => {
      board.updateColumn(command.columnId, command.changes);
    });
  }
}

export class DeleteColumn implements DeleteColumnUseCase {
  private readonly repository: BoardRepository;
  private readonly clock: Clock;

  constructor(repository: BoardRepository, clock: Clock) {
    this.repository = repository;
    this.clock = clock;
  }

  execute(command: DeleteColumnCommand): Promise<BoardView> {
    return mutateBoard(this.repository, this.clock, (board) => {
      board.removeColumn(command.columnId, command.moveTasksTo);
    });
  }
}

export class MoveColumn implements MoveColumnUseCase {
  private readonly repository: BoardRepository;
  private readonly clock: Clock;

  constructor(repository: BoardRepository, clock: Clock) {
    this.repository = repository;
    this.clock = clock;
  }

  execute(command: MoveColumnCommand): Promise<BoardView> {
    return mutateBoard(this.repository, this.clock, (board) => {
      board.moveColumn(command.columnId, command.position);
    });
  }
}

/**
 * Ordena las tareas de una columna con la estrategia indicada.
 * Recibe las estrategias disponibles por constructor: agregar un criterio
 * nuevo no requiere tocar esta clase (OCP).
 */
export class SortColumn implements SortColumnUseCase {
  private readonly repository: BoardRepository;
  private readonly clock: Clock;
  private readonly orderings: ReadonlyMap<string, TaskOrdering>;

  constructor(repository: BoardRepository, clock: Clock, orderings: readonly TaskOrdering[]) {
    this.repository = repository;
    this.clock = clock;
    this.orderings = new Map(orderings.map((o) => [o.key, o]));
  }

  execute(command: SortColumnCommand): Promise<BoardView> {
    const ordering = this.orderings.get(command.by);
    if (!ordering) {
      const valid = [...this.orderings.keys()].join(', ');
      return Promise.reject(new ValidationError(`Criterio de orden desconocido. Usa uno de: ${valid}`));
    }
    return mutateBoard(this.repository, this.clock, (board) => {
      board.sortColumn(command.columnId, ordering);
    });
  }
}
