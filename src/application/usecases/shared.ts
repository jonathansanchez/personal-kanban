import { NotFoundError } from '../../domain/errors.ts';
import type { Board } from '../../domain/model/Board.ts';
import type { BoardView } from '../ports/in/BoardUseCases.ts';
import type { BoardRepository } from '../ports/out/BoardRepository.ts';
import type { Clock } from '../ports/out/Clock.ts';

export async function requireBoard(repository: BoardRepository): Promise<Board> {
  const board = await repository.load();
  if (!board) throw new NotFoundError('El tablero aún no ha sido inicializado');
  return board;
}

/**
 * Flujo común de los casos de uso que modifican el tablero:
 * cargar → aplicar la regla de dominio → marcar fecha → guardar → devolver vista.
 * Si la regla lanza un error, no se guarda nada.
 */
export async function mutateBoard(
  repository: BoardRepository,
  clock: Clock,
  mutate: (board: Board, now: Date) => void,
): Promise<BoardView> {
  const board = await requireBoard(repository);
  const now = clock.now();
  mutate(board, now);
  board.touch(now);
  await repository.save(board);
  return board.toSnapshot();
}
