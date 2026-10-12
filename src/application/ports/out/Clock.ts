/**
 * Puerto de salida: fuente de la hora actual.
 * Abstraerla permite tests deterministas con un reloj fijo.
 */
export interface Clock {
  now(): Date;
}
