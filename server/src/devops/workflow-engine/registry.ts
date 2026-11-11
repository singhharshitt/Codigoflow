import { nodeExecutors } from './executors';
import type { NodeExecutor } from './types';

const byKind = new Map<string, NodeExecutor>(nodeExecutors.map((e) => [e.kind, e]));

export function resolveNodeKind(kind: string): string {
  return kind;
}

export function getExecutor(kind: string): NodeExecutor | undefined {
  return byKind.get(resolveNodeKind(kind));
}

export function listExecutableKinds(): string[] {
  return [...byKind.keys()].sort();
}

export function isExecutableKind(kind: string): boolean {
  return byKind.has(resolveNodeKind(kind));
}
