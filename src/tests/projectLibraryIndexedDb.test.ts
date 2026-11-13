import { describe, expect, it } from 'vitest';
import { createIndexedDbBackend, type LibraryEntry } from '../utils/persistence/projectLibrary';

/**
 * The IndexedDB backend's writes report the outcome of their TRANSACTION.
 * IndexedDB can let a request succeed and still abort the transaction at
 * commit (a full disk raises QuotaExceededError then), so a write that
 * resolved on the request said "Saved" for a graphic that was never stored.
 *
 * A minimal stand-in factory: every request succeeds; the transaction then
 * commits or aborts as the test asks.
 */
type Outcome = 'commit' | 'abort';

const fakeFactory = (outcome: () => Outcome) => {
  const committed = new Map<string, LibraryEntry>();
  const request = <T,>(result: T) => {
    const req = { result, onsuccess: null as null | (() => void), onerror: null as null | (() => void), error: null };
    queueMicrotask(() => req.onsuccess?.());
    return req;
  };
  const database = {
    transaction: () => {
      const staged: Array<() => void> = [];
      const transaction = {
        oncomplete: null as null | (() => void),
        onerror: null as null | (() => void),
        onabort: null as null | (() => void),
        error: null as null | DOMException,
        objectStore: () => ({
          put: (entry: LibraryEntry) => { staged.push(() => committed.set(entry.id, entry)); return request(entry.id); },
          delete: (id: string) => { staged.push(() => committed.delete(id)); return request(undefined); },
          get: (id: string) => request(committed.get(id)),
          getAll: () => request([...committed.values()]),
        }),
      };
      // The request succeeds first; the transaction settles afterwards.
      setTimeout(() => {
        if (outcome() === 'commit') {
          staged.forEach((apply) => apply());
          transaction.oncomplete?.();
        } else {
          transaction.error = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
          transaction.onabort?.();
        }
      }, 0);
      return transaction;
    },
  };
  const factory = {
    open: () => {
      const req = { result: database, onsuccess: null as null | (() => void), onerror: null, onupgradeneeded: null };
      queueMicrotask(() => req.onsuccess?.());
      return req;
    },
  } as unknown as IDBFactory;
  return { factory, committed };
};

const entry = (id: string): LibraryEntry => ({ id, name: id, updatedAt: 1, layerCount: 0, scene: '{}' } as LibraryEntry);

describe('IndexedDB library backend', () => {
  it('a write resolves once its transaction commits', async () => {
    const { factory, committed } = fakeFactory(() => 'commit');
    const backend = createIndexedDbBackend(factory);
    await backend.put(entry('a'));
    expect(committed.has('a')).toBe(true);
    await backend.remove('a');
    expect(committed.has('a')).toBe(false);
  });

  it('a write whose transaction aborts at commit rejects with the abort reason', async () => {
    const { factory, committed } = fakeFactory(() => 'abort');
    const backend = createIndexedDbBackend(factory);
    await expect(backend.put(entry('a'))).rejects.toMatchObject({ name: 'QuotaExceededError' });
    expect(committed.has('a')).toBe(false);
  });

  it('a removal that aborts rejects too', async () => {
    let outcome: Outcome = 'commit';
    const { factory, committed } = fakeFactory(() => outcome);
    const backend = createIndexedDbBackend(factory);
    await backend.put(entry('a'));
    outcome = 'abort';
    await expect(backend.remove('a')).rejects.toMatchObject({ name: 'QuotaExceededError' });
    expect(committed.has('a')).toBe(true);
  });
});
