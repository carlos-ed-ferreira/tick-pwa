import type { AppScope, AppScopeId } from './types';

export function createGuestScope(installationId: string): AppScope {
  return {
    id: `guest:${installationId}`,
    kind: 'guest',
    ownerId: installationId,
  };
}

export function createUserScope(userId: string): AppScope {
  return {
    id: `user:${userId}`,
    kind: 'user',
    ownerId: userId,
  };
}

export function parseAppScopeId(scopeId: AppScopeId): AppScope {
  const [kind, ownerId] = scopeId.split(':', 2);

  if ((kind !== 'guest' && kind !== 'user') || !ownerId) {
    throw new Error(`Invalid app scope id: ${scopeId}`);
  }

  return {
    id: scopeId,
    kind,
    ownerId,
  };
}

export function isGuestScope(scope: AppScope): boolean {
  return scope.kind === 'guest';
}

export function isUserScope(scope: AppScope): boolean {
  return scope.kind === 'user';
}
