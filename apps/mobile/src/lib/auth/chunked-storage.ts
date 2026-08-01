const DEFAULT_CHUNK_BYTES = 1024;
const MAX_CHUNKS = 512;
const VERSION_PATTERN = /^[a-z0-9_-]{1,64}$/i;
let versionSequence = 0;

function defaultVersion() {
  versionSequence += 1;
  return `${Date.now().toString(36)}-${versionSequence.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export interface AsyncStringStore {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
}

interface ChunkManifest {
  version: string;
  count: number;
}

interface ChunkedStorageOptions {
  maxChunkBytes?: number;
  createVersion?: () => string;
}

function manifestKey(key: string) {
  return `${key}.manifest`;
}

function chunkKey(key: string, version: string, index: number) {
  return `${key}.${version}.${index}`;
}

export function splitUtf8Chunks(
  value: string,
  maxChunkBytes = DEFAULT_CHUNK_BYTES,
) {
  if (!Number.isInteger(maxChunkBytes) || maxChunkBytes < 4) {
    throw new Error('Chunk size must be an integer of at least four bytes.');
  }
  if (value.length === 0) return [''];

  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let chunk = '';
  let chunkBytes = 0;

  for (const symbol of value) {
    const symbolBytes = encoder.encode(symbol).byteLength;
    if (chunk && chunkBytes + symbolBytes > maxChunkBytes) {
      chunks.push(chunk);
      chunk = '';
      chunkBytes = 0;
    }
    chunk += symbol;
    chunkBytes += symbolBytes;
  }

  if (chunk) chunks.push(chunk);
  return chunks;
}

export function createChunkedSessionStorage(
  store: AsyncStringStore,
  options: ChunkedStorageOptions = {},
) {
  const maxChunkBytes = options.maxChunkBytes ?? DEFAULT_CHUNK_BYTES;
  const createVersion = options.createVersion ?? defaultVersion;

  async function readManifest(key: string): Promise<ChunkManifest | null> {
    const raw = await store.getItemAsync(manifestKey(key));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as ChunkManifest;
      return VERSION_PATTERN.test(parsed.version) &&
        Number.isInteger(parsed.count) &&
        parsed.count > 0 &&
        parsed.count <= MAX_CHUNKS
        ? parsed
        : null;
    } catch {
      return null;
    }
  }

  async function removeChunks(key: string, manifest: ChunkManifest | null) {
    if (!manifest) return;
    await Promise.all(
      Array.from({ length: manifest.count }, (_, index) =>
        store.deleteItemAsync(chunkKey(key, manifest.version, index)),
      ),
    );
  }

  return {
    async getItem(key: string): Promise<string | null> {
      const manifest = await readManifest(key);
      if (!manifest) return null;
      const chunks = await Promise.all(
        Array.from({ length: manifest.count }, (_, index) =>
          store.getItemAsync(chunkKey(key, manifest.version, index)),
        ),
      );
      return chunks.every((item): item is string => item !== null)
        ? chunks.join('')
        : null;
    },

    async setItem(key: string, value: string): Promise<void> {
      const previous = await readManifest(key);
      const version = createVersion();
      if (!VERSION_PATTERN.test(version)) {
        throw new Error('Storage version contains unsupported characters.');
      }
      if (previous?.version === version) {
        throw new Error('Storage version must change before replacing a session.');
      }
      const chunks = splitUtf8Chunks(value, maxChunkBytes);
      if (chunks.length > MAX_CHUNKS) {
        throw new Error('Session is too large for secure device storage.');
      }

      await Promise.all(
        chunks.map((item, index) =>
          store.setItemAsync(chunkKey(key, version, index), item),
        ),
      );
      await store.setItemAsync(
        manifestKey(key),
        JSON.stringify({ version, count: chunks.length }),
      );
      await removeChunks(key, previous);
    },

    async removeItem(key: string): Promise<void> {
      const manifest = await readManifest(key);
      await store.deleteItemAsync(manifestKey(key));
      await removeChunks(key, manifest);
    },
  };
}
