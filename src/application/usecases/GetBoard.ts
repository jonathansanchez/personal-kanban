import type { BoardView, GetBoardUseCase } from '../ports/in/BoardUseCases.ts';
import type { BoardRepository } from '../ports/out/BoardRepository.ts';
import { requireBoard } from './shared.ts';

export class GetBoard implements GetBoardUseCase {
  private readonly repository: BoardRepository;

  constructor(repository: BoardRepository) {
    this.repository = repository;
  }

  async execute(): Promise<BoardView> {
    return (await requireBoard(this.repository)).toSnapshot();
  }
}
