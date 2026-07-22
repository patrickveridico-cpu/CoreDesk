import { copyFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { LoggerService } from '../logging/LoggerService'

export interface StorageReadOptions<T> {
  schemaVersion: number
  validate?: (value: unknown) => T
  backupInvalid?: boolean
}

export class StorageService {
  constructor(private readonly logger?: LoggerService) {}

  async read<T>(filePath: string, fallback: T, options: StorageReadOptions<T>): Promise<T> {
    await mkdir(path.dirname(filePath), { recursive: true })
    try {
      const parsed = JSON.parse(await readFile(filePath, 'utf8')) as { schemaVersion?: number; data?: unknown }
      const value = options.validate ? options.validate(parsed.data ?? parsed) : (parsed.data ?? parsed) as T
      if (parsed.schemaVersion !== undefined && parsed.schemaVersion > options.schemaVersion) throw new Error('Schema de armazenamento mais recente que o aplicativo.')
      return value
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.write(filePath, fallback, options.schemaVersion)
        return fallback
      }
      if (options.backupInvalid !== false) await this.backup(filePath)
      this.logger?.warn('Arquivo de armazenamento inválido; usando valores padrão.', { filePath, reason: error instanceof Error ? error.message : 'unknown' })
      return fallback
    }
  }

  async write<T>(filePath: string, data: T, schemaVersion: number) {
    await mkdir(path.dirname(filePath), { recursive: true })
    const temporaryPath = `${filePath}.tmp`
    await writeFile(temporaryPath, JSON.stringify({ schemaVersion, data }, null, 2), { encoding: 'utf8', mode: 0o600 })
    await rename(temporaryPath, filePath)
  }

  /** Raw JSON adapter used by legacy stores whose file shape is already public. */
  async readRaw<T>(filePath: string, fallback: T, validate?: (value: unknown) => T): Promise<T> {
    await mkdir(path.dirname(filePath), { recursive: true })
    let value: unknown
    try {
      value = JSON.parse(await readFile(filePath, 'utf8')) as unknown
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.writeRaw(filePath, fallback)
        return fallback
      }
      await this.backup(filePath)
      this.logger?.warn('Arquivo legado inválido; valores padrão restaurados.', { filePath, reason: error instanceof Error ? error.message : 'unknown' })
      await this.writeRaw(filePath, fallback)
      return fallback
    }
    return validate ? validate(value) : value as T
  }

  async writeRaw<T>(filePath: string, data: T) {
    await mkdir(path.dirname(filePath), { recursive: true })
    const temporaryPath = `${filePath}.tmp`
    await writeFile(temporaryPath, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 })
    await rename(temporaryPath, filePath)
  }

  private async backup(filePath: string) {
    try {
      await stat(filePath)
      await copyFile(filePath, `${filePath}.invalid-${Date.now()}.bak`)
    } catch { /* file may not exist */ }
  }
}
