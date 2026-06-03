import { unlink } from 'node:fs/promises';

export interface StorageBackend {
  /**
   * Delete a file by its storage path. Must not throw — log failures and
   * return false so the caller can decide whether to retry or alert.
   */
  delete(path: string): Promise<boolean>;
}

export class LocalStorageBackend implements StorageBackend {
  async delete(path: string): Promise<boolean> {
    try {
      await unlink(path);
      return true;
    } catch (err: unknown) {
      // ENOENT is benign: file already gone, treat as success.
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return true;
      return false;
    }
  }
}

// No-op backend used in tests and dry-run mode.
export class NoOpStorageBackend implements StorageBackend {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async delete(path: string): Promise<boolean> {
    return true;
  }
}
