/** Puerto de salida: genera identificadores únicos. */
export interface IdGenerator {
  next(): string;
}
