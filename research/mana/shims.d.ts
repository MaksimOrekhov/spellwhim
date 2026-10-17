// Minimal Node typings so the research scripts type-check without adding @types/node as a dependency.
declare module 'node:fs' {
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void
  export function readdirSync(path: string): string[]
  export function readFileSync(path: string, encoding: 'utf8'): string
  export function writeFileSync(path: string, data: string): void
  export function existsSync(path: string): boolean
}
declare module 'node:path' {
  export function join(...parts: string[]): string
}
declare const process: { argv: string[]; exitCode?: number; stderr: { write(text: string): void } }
