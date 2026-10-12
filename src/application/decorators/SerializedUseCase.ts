import type { UseCase } from '../ports/in/BoardUseCases.ts';

/**
 * Cola FIFO muy simple: ejecuta las tareas de a una.
 * Evita que dos peticiones simultáneas lean el mismo estado y una pise
 * los cambios de la otra (patrón leer-modificar-guardar).
 */
export class SerialQueue {
  #tail: Promise<unknown> = Promise.resolve();

  run<T>(work: () => Promise<T>): Promise<T> {
    const result = this.#tail.then(work, work);
    this.#tail = result.catch(() => undefined);
    return result;
  }
}

/**
 * Decorador: envuelve cualquier caso de uso para que se ejecute dentro de la
 * cola. El caso de uso original no cambia (OCP) y el decorador cumple el
 * mismo contrato, por lo que es intercambiable con él (LSP).
 */
export class SerializedUseCase<I, O> implements UseCase<I, O> {
  private readonly inner: UseCase<I, O>;
  private readonly queue: SerialQueue;

  constructor(inner: UseCase<I, O>, queue: SerialQueue) {
    this.inner = inner;
    this.queue = queue;
  }

  execute(input: I): Promise<O> {
    return this.queue.run(() => this.inner.execute(input));
  }
}
