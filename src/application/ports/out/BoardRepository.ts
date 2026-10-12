import type { Board } from '../../../domain/model/Board.ts';

/**
 * Puerto de salida (driven port) para la persistencia del tablero.
 * El núcleo solo conoce esta interfaz; el adaptador concreto (archivo JSON,
 * Redis, memoria...) se elige en el composition root (src/main.ts).
 */
export interface BoardRepository {
  /** Devuelve el tablero guardado o null si aún no existe. */
  load(): Promise<Board | null>;
  save(board: Board): Promise<void>;
}
