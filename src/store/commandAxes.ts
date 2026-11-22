/**
 * @file src/store/commandAxes.ts
 * @description Reexporta la conversión de ejes del contrato externo, que vive en
 * `core/scene/userAxesContract` para que el bus de la app y el MCP sin interfaz usen las mismas funciones.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export * from '../core/scene/userAxesContract';
