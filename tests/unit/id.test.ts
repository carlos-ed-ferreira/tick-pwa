import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOperationId } from '@/lib/db/account-entity-tables';
import { createId } from '@/lib/domain/id';

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

describe('random identifiers without crypto.randomUUID', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ['entity ids', createId],
    ['operation ids', createOperationId],
  ])('builds %s as UUID v4 from cryptographic random values', (_, create) => {
    const realCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', {
      getRandomValues: (values: Uint8Array) =>
        realCrypto.getRandomValues(values),
    });
    const mathRandom = vi.spyOn(Math, 'random');

    expect(create()).toMatch(uuidV4);
    expect(mathRandom).not.toHaveBeenCalled();
  });
});
