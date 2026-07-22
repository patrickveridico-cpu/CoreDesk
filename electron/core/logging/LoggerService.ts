import { appendFile, mkdir, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
const SENSITIVE_KEYS = /cookie|token|credential|password|authorization|localStorage|indexeddb|qr|message/i

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEYS.test(key) ? '[REDACTED]' : sanitize(item)]))
  }
  if (typeof value === 'string' && SENSITIVE_KEYS.test(value)) return '[REDACTED]'
  return value
}

export class LoggerService {
  private queue = Promise.resolve()
  private readonly filePath: string

  constructor(
    directory: string,
    private readonly context = 'core',
    private readonly development = process.env.NODE_ENV !== 'production',
    private readonly maxBytes = 2 * 1024 * 1024,
  ) {
    this.filePath = path.join(directory, 'coredesk.log')
  }

  child(context: string) {
    return new LoggerService(path.dirname(this.filePath), `${this.context}:${context}`, this.development, this.maxBytes)
  }

  debug(message: string, data?: unknown) { this.write('debug', message, data) }
  info(message: string, data?: unknown) { this.write('info', message, data) }
  warn(message: string, data?: unknown) { this.write('warn', message, data) }
  error(message: string, data?: unknown) { this.write('error', message, data) }

  private write(level: LogLevel, message: string, data?: unknown) {
    const entry = JSON.stringify({ time: new Date().toISOString(), level, context: this.context, message, data: data === undefined ? undefined : sanitize(data) })
    if (this.development) console[level === 'debug' ? 'log' : level](entry)
    this.queue = this.queue.then(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true })
      try {
        if ((await stat(this.filePath)).size + Buffer.byteLength(`${entry}\n`) > this.maxBytes) {
          await rename(this.filePath, `${this.filePath}.1`).catch(() => undefined)
          await writeFile(this.filePath, '')
        }
      } catch { /* first write */ }
      await appendFile(this.filePath, `${entry}\n`, 'utf8')
    }).catch(() => undefined)
  }
}

export { sanitize as sanitizeLogData }
