/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createChunkedSessionStorage,
  splitUtf8Chunks,
  type AsyncStringStore,
} from './chunked-storage';

function memoryStore() {
  const values = new Map<string, string>();
  const store: AsyncStringStore = {
    async getItemAsync(key) {
      return values.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      values.set(key, value);
    },
    async deleteItemAsync(key) {
      values.delete(key);
    },
  };
  return { store, values };
}

describe('splitUtf8Chunks', () => {
  it('keeps every chunk within its UTF-8 byte budget', () => {
    const chunks = splitUtf8Chunks('fresh-🥭-කෙසෙල්-'.repeat(8), 16);
    const encoder = new TextEncoder();

    assert.equal(chunks.join(''), 'fresh-🥭-කෙසෙල්-'.repeat(8));
    assert.ok(chunks.every((chunk) => encoder.encode(chunk).byteLength <= 16));
  });
});

describe('createChunkedSessionStorage', () => {
  it('round-trips multibyte session data', async () => {
    const { store } = memoryStore();
    const storage = createChunkedSessionStorage(store, {
      maxChunkBytes: 16,
      createVersion: () => 'v1',
    });
    const session = JSON.stringify({ token: '🥭'.repeat(40), name: 'කෙසෙල්' });

    await storage.setItem('session', session);
    assert.equal(await storage.getItem('session'), session);
  });

  it('atomically replaces the manifest and removes old chunks', async () => {
    const { store, values } = memoryStore();
    let version = 0;
    const storage = createChunkedSessionStorage(store, {
      maxChunkBytes: 8,
      createVersion: () => `v${++version}`,
    });

    await storage.setItem('session', 'first session payload');
    const oldChunkKeys = [...values.keys()].filter((key) => key.includes('.v1.'));
    await storage.setItem('session', 'replacement');

    assert.equal(await storage.getItem('session'), 'replacement');
    assert.ok(oldChunkKeys.every((key) => !values.has(key)));
  });

  it('removes the manifest and all active chunks', async () => {
    const { store, values } = memoryStore();
    const storage = createChunkedSessionStorage(store, {
      maxChunkBytes: 8,
      createVersion: () => 'v1',
    });

    await storage.setItem('session', 'a persisted session');
    await storage.removeItem('session');

    assert.equal(await storage.getItem('session'), null);
    assert.equal(values.size, 0);
  });
});
