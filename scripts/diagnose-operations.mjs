import { access, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const appData = process.env.APPDATA ?? path.join(process.env.USERPROFILE ?? process.cwd(), 'AppData', 'Roaming')
const filePath = path.resolve(appData, 'coredesk', 'operations', 'operations.json')
const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[._-]+/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
try {
  await access(filePath)
  const [metadata, raw] = await Promise.all([stat(filePath), readFile(filePath, 'utf8')])
  const parsed = JSON.parse(raw); const data = parsed.data ?? parsed; const tables = Array.isArray(data.pricingTables) ? data.pricingTables : []; const conflicts = new Map()
  for (const table of tables.filter((item) => item.status === 'active' && item.companyId)) { const key = `${table.companyId}|${table.insurerId}|${table.specialtyId}`; conflicts.set(key, [...(conflicts.get(key) ?? []), table.id]) }
  const groups = [...conflicts.values()].filter((ids) => ids.length > 1)
  console.log(JSON.stringify({ filePath, fileSize: metadata.size, modifiedAt: metadata.mtime.toISOString(), companies: data.operationalCompanies?.length ?? 0, insurers: data.insurers?.length ?? 0, specialties: data.specialties?.length ?? 0, bases: data.bases?.length ?? 0, tables: tables.length, withCompanyId: tables.filter((item) => item.companyId).length, withoutCompanyId: tables.filter((item) => !item.companyId).length, legacyCompanies: Object.fromEntries(Object.entries(Object.groupBy(tables, (item) => normalize(item.company))).map(([key, value]) => [key, value.length])), conflicts: groups.length, conflictingRecords: groups.reduce((sum, ids) => sum + ids.length, 0) }, null, 2))
} catch (error) {
  if (error?.code === 'ENOENT') { console.log(JSON.stringify({ filePath, found: false, tables: 0 }, null, 2)); process.exit(0) }
  console.error(`Falha ao diagnosticar operações: ${error instanceof Error ? error.message : String(error)}`); process.exit(1)
}
