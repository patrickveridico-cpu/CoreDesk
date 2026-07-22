import { copyFile, mkdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type { StorageService } from '../../../core/storage/StorageService'
import type { OperationsData } from '../../../../shared/operations/models'
import { emptyOperationsData, validateOperationsData } from '../../../../shared/operations/schemas'

export class OperationsRepository {
  private readonly filePath: string
  constructor(userDataPath: string, private readonly storage: StorageService) { this.filePath = path.join(userDataPath, 'operations', 'operations.json') }
  getPath() { return this.filePath }
  async inspect() {
    try {
      const metadata = await stat(this.filePath)
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as { schemaVersion?: number; data?: unknown }
      const data = validateOperationsData(parsed.data ?? parsed)
      return { found: true, valid: true, fileSize: metadata.size, modifiedAt: metadata.mtime.toISOString(), data, error: undefined }
    } catch (error) {
      const found = (error as NodeJS.ErrnoException).code !== 'ENOENT'
      const metadata = found ? await stat(this.filePath).catch(() => undefined) : undefined
      return { found, valid: false, fileSize: metadata?.size ?? 0, modifiedAt: metadata?.mtime.toISOString(), data: undefined, error: error instanceof Error ? error.message : String(error) }
    }
  }
  async backupBeforeMigration() {
    const backupDirectory = path.join(path.dirname(this.filePath), 'backups')
    await mkdir(backupDirectory, { recursive: true })
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '').replace('T', '-')
    const backupPath = path.join(backupDirectory, `operations.backup-${stamp}.json`)
    await copyFile(this.filePath, backupPath)
    return backupPath
  }
  load() { return this.storage.read(this.filePath, emptyOperationsData(), { schemaVersion: 3, validate: validateOperationsData }) }
  save(data: OperationsData) { return this.storage.write(this.filePath, validateOperationsData(data), 3) }
}
