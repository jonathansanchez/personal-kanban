import { Board } from '../../domain/model/Board.ts';
import { Column } from '../../domain/model/Column.ts';
import type { BoardView, InitializeBoardUseCase } from '../ports/in/BoardUseCases.ts';
import type { BoardRepository } from '../ports/out/BoardRepository.ts';
import type { Clock } from '../ports/out/Clock.ts';
import type { IdGenerator } from '../ports/out/IdGenerator.ts';

export const DEFAULT_COLUMNS = [
  { name: 'Por hacer', color: '#64748b' },
  { name: 'En progreso', color: '#2563eb' },
  { name: 'Hecho', color: '#16a34a' },
] as const;

/** Crea el tablero con columnas iniciales solo si todavía no existe. */
export class InitializeBoard implements InitializeBoardUseCase {
  private readonly repository: BoardRepository;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  constructor(repository: BoardRepository, ids: IdGenerator, clock: Clock) {
    this.repository = repository;
    this.ids = ids;
    this.clock = clock;
  }

  async execute(): Promise<BoardView> {
    const existing = await this.repository.load();
    if (existing) return existing.toSnapshot();

    const board = Board.create('Mi tablero', this.clock.now());
    for (const column of DEFAULT_COLUMNS) {
      board.addColumn(Column.create(this.ids.next(), column));
    }
    await this.repository.save(board);
    return board.toSnapshot();
  }
}
