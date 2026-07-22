import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WhatsAppProfileStore } from '../electron/whatsapp/WhatsAppProfileStore'
import { performProfileRemoval } from '../electron/whatsapp/profile-removal'

const temporaryDirectories: string[] = []
async function createStore(ids = ['one', 'two', 'three']) {
  const directory = await mkdtemp(path.join(tmpdir(), 'coredesk-profile-test-'))
  temporaryDirectories.push(directory)
  let index = 0
  const store = new WhatsAppProfileStore(path.join(directory, 'profiles.json'), () => ids[index++] ?? `extra-${index}`)
  await store.load()
  return { store, directory }
}

afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))))

describe('armazenamento de perfis', () => {
  it('persiste e restaura metadados sem credenciais', async () => {
    const { store, directory } = await createStore()
    const created = await store.create({ name: 'Comercial', accentColor: '#22c55e' })
    const restored = new WhatsAppProfileStore(path.join(directory, 'profiles.json'))
    const snapshot = await restored.load()
    expect(snapshot.profiles[0]).toMatchObject({ id: created.id, name: 'Comercial', partition: 'persist:coredesk-whatsapp-one' })
    expect(await readFile(path.join(directory, 'profiles.json'), 'utf8')).not.toMatch(/cookie|token|credential/i)
  })

  it('previne partitions duplicadas na restauração', async () => {
    const { directory } = await createStore()
    const file = path.join(directory, 'duplicate.json')
    const base = { name: 'A', partition: 'persist:duplicada', order: 0, enabled: true, open: true, suspended: false, notificationsEnabled: false, createdAt: '', updatedAt: '' }
    await writeFile(file, JSON.stringify({ version: 1, profiles: [{ ...base, id: 'a' }, { ...base, id: 'b', order: 1 }] }))
    await expect(new WhatsAppProfileStore(file).load()).rejects.toThrow('duplicada')
  })

  it('reordena todos os perfis', async () => {
    const { store } = await createStore()
    const first = await store.create({ name: 'A' })
    const second = await store.create({ name: 'B' })
    expect((await store.reorder([second.id, first.id])).map((item) => item.id)).toEqual([second.id, first.id])
  })

  it('remove preservando a sessão por padrão', async () => {
    const destroyView = vi.fn()
    const clearPartition = vi.fn(async () => undefined)
    await performProfileRemoval({ id: 'a', partition: 'persist:a' }, false, { destroyView, clearPartition })
    expect(destroyView).toHaveBeenCalledWith('whatsapp:a')
    expect(clearPartition).not.toHaveBeenCalled()
  })

  it('remove e limpa somente a partition solicitada', async () => {
    const destroyView = vi.fn()
    const clearPartition = vi.fn(async () => undefined)
    await performProfileRemoval({ id: 'b', partition: 'persist:b' }, true, { destroyView, clearPartition })
    expect(clearPartition).toHaveBeenCalledOnce()
    expect(clearPartition).toHaveBeenCalledWith('persist:b')
  })
})
