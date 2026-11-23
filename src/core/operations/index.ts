/**
 * @file src/core/operations/index.ts
 * @description Punto de entrada de las operaciones de escena puras compartidas por el store de la
 * app y el motor headless del servidor MCP.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export * from './operationTypes';
export * from './csgOperations';
export * from './meshOperations';
export * from './partOperations';
export * from './creationOperations';
export * from './alignOperations';
export * from './splitOperations';
export * from './fitOperations';
export * from './paintOperations';
export * from './organizeOperations';
export * from './repairReport';
