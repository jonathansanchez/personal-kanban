import { Task } from '../../domain/model/Task.ts';
import type {
  BoardView,
  CreateTaskCommand,
  CreateTaskUseCase,
  DeleteTaskCommand,
  DeleteTaskUseCase,
  MoveTaskCommand,
  MoveTaskUseCase,
  UpdateTaskCommand,
  UpdateTaskUseCase,
} from '../ports/in/BoardUseCases.ts';
import type { BoardRepository } from '../ports/out/BoardRepository.ts';
import type { Clock } from '../ports/out/Clock.ts';
import type { IdGenerator } from '../ports/out/IdGenerator.ts';
import { mutateBoard } from './shared.ts';

export class CreateTask implements CreateTaskUseCase {
  private readonly repository: BoardRepository;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  constructor(repository: BoardRepository, ids: IdGenerator, clock: Clock) {
    this.repository = repository;
    this.ids = ids;
    this.clock = clock;
  }

  execute(command: CreateTaskCommand): Promise<BoardView> {
    return mutateBoard(this.repository, this.clock, (board, now) => {
      board.getColumn(command.columnId); // falla rápido si la columna no existe
      const task = Task.create(this.ids.next(), command, now);
      board.addTask(command.columnId, task, command.position);
    });
  }
}

export class UpdateTask implements UpdateTaskUseCase {
  private readonly repository: BoardRepository;
  private readonly clock: Clock;

  constructor(repository: BoardRepository, clock: Clock) {
    this.repository = repository;
    this.clock = clock;
  }

  execute(command: UpdateTaskCommand): Promise<BoardView> {
    return mutateBoard(this.repository, this.clock, (board, now) => {
      board.updateTask(command.taskId, command.changes, now);
    });
  }
}

export class MoveTask implements MoveTaskUseCase {
  private readonly repository: BoardRepository;
  private readonly clock: Clock;

  constructor(repository: BoardRepository, clock: Clock) {
    this.repository = repository;
    this.clock = clock;
  }

  execute(command: MoveTaskCommand): Promise<BoardView> {
    return mutateBoard(this.repository, this.clock, (board) => {
      board.moveTask(command.taskId, command.toColumnId, command.position);
    });
  }
}

export class DeleteTask implements DeleteTaskUseCase {
  private readonly repository: BoardRepository;
  private readonly clock: Clock;

  constructor(repository: BoardRepository, clock: Clock) {
    this.repository = repository;
    this.clock = clock;
  }

  execute(command: DeleteTaskCommand): Promise<BoardView> {
    return mutateBoard(this.repository, this.clock, (board) => {
      board.removeTask(command.taskId);
    });
  }
}
