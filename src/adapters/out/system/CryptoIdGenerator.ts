import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '../../../application/ports/out/IdGenerator.ts';

export class CryptoIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
