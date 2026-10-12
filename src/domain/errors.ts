/**
 * Errores de dominio. No dependen de HTTP ni de ningún framework:
 * los adaptadores de entrada deciden cómo traducirlos (p. ej. a códigos HTTP).
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Los datos recibidos no cumplen las reglas del dominio. */
export class ValidationError extends DomainError {}

/** El recurso solicitado (columna, tarea, tablero) no existe. */
export class NotFoundError extends DomainError {}
