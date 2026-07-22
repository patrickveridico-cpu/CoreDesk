import WebSocket from 'ws'

const endpoint = process.env.COREDESK_CDP_URL ?? 'http://127.0.0.1:9230'
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const targetList = () => fetch(`${endpoint}/json/list`).then((response) => response.json())

async function command(target, method, params = {}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl)
    const id = Math.floor(Math.random() * 1_000_000)
    socket.once('open', () => socket.send(JSON.stringify({ id, method, params })))
    socket.on('message', (buffer) => {
      const message = JSON.parse(buffer.toString())
      if (message.id !== id) return
      socket.close()
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
    })
    socket.once('error', reject)
  })
}

async function evaluate(target, expression) {
  const response = await command(target, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text)
  return response.result.value
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

let targets = await targetList()
const shell = targets.find((target) => target.title === 'CoreDesk')
assert(shell, 'Shell CoreDesk não encontrado')

let snapshot = await evaluate(shell, 'window.coreDesk.whatsapp.listProfiles()')
if (snapshot.profiles.length === 0) {
  for (const input of [
    { name: 'Atendimento', accentColor: '#1cc8ee', iconToken: 'builtin:message' },
    { name: 'Comercial', accentColor: '#22c55e', iconToken: 'initials' },
    { name: 'Operações', accentColor: '#a78bfa', iconToken: 'initials' },
  ]) {
    await evaluate(shell, `window.coreDesk.whatsapp.createProfile(${JSON.stringify(input)})`)
  }
}
await sleep(7000)
snapshot = await evaluate(shell, 'window.coreDesk.whatsapp.listProfiles()')
assert(snapshot.profiles.length === 3, 'Devem existir exatamente três perfis principais')
assert(new Set(snapshot.profiles.map((profile) => profile.partition)).size === 3, 'As três partitions devem ser diferentes')
assert(snapshot.profiles.every((profile) => profile.partition === `persist:coredesk-whatsapp-${profile.id}`), 'Partition deve ser derivada do id imutável')

targets = await targetList()
let whatsappTargets = targets.filter((target) => target.type === 'page' && target.url.includes('web.whatsapp.com'))
assert(whatsappTargets.length === 3, `Esperadas três views do WhatsApp, encontradas ${whatsappTargets.length}`)
const origins = new Map()
for (const target of whatsappTargets) origins.set(target.id, await evaluate(target, 'performance.timeOrigin'))

for (const profile of [...snapshot.profiles, ...snapshot.profiles].slice(0, 6)) {
  await evaluate(shell, `([...document.querySelectorAll('[role="tab"]')].find((element) => element.textContent.includes(${JSON.stringify(profile.name)})))?.click()`)
  await sleep(120)
}
targets = await targetList()
whatsappTargets = targets.filter((target) => origins.has(target.id))
for (const target of whatsappTargets) assert(await evaluate(target, 'performance.timeOrigin') === origins.get(target.id), 'Trocar perfil não pode recarregar WhatsApp')

const first = snapshot.profiles[0]
const firstPartition = first.partition
await evaluate(shell, `window.coreDesk.whatsapp.updateProfile(${JSON.stringify(first.id)}, { name: 'Atendimento Principal', accentColor: '#f59e0b' })`)
snapshot = await evaluate(shell, 'window.coreDesk.whatsapp.listProfiles()')
assert(snapshot.profiles.find((profile) => profile.id === first.id).partition === firstPartition, 'Renomear não pode alterar a partition')

const reordered = [...snapshot.profiles].reverse().map((profile) => profile.id)
await evaluate(shell, `window.coreDesk.whatsapp.reorderProfiles(${JSON.stringify(reordered)})`)
snapshot = await evaluate(shell, 'window.coreDesk.whatsapp.listProfiles()')
assert(snapshot.profiles.map((profile) => profile.id).join(',') === reordered.join(','), 'Reordenação deve persistir')

await evaluate(shell, `window.coreDesk.whatsapp.openProfile(${JSON.stringify(first.id)})`)
await sleep(400)
const visibleBeforeClose = await targetList()
let firstTarget = undefined
for (const target of visibleBeforeClose.filter((item) => origins.has(item.id))) {
  if (await evaluate(target, 'document.visibilityState') === 'visible') firstTarget = target
}
assert(firstTarget, 'A view ativa do primeiro perfil deve estar visível')
await evaluate(shell, `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', ctrlKey: true }))`)
await sleep(500)
assert((await targetList()).some((target) => origins.has(target.id)), 'Fechar aba não deve destruir a view do perfil')
await evaluate(shell, `window.coreDesk.whatsapp.openProfile(${JSON.stringify(first.id)})`)
await sleep(500)
assert(firstTarget && await evaluate(firstTarget, 'performance.timeOrigin') === origins.get(firstTarget.id), 'Reabrir pela sidebar deve usar a mesma view')

await evaluate(shell, `window.coreDesk.whatsapp.suspendProfile(${JSON.stringify(first.id)})`)
await sleep(300)
await evaluate(shell, `window.coreDesk.whatsapp.resumeProfile(${JSON.stringify(first.id)})`)
await sleep(300)
assert((await targetList()).some((target) => target.id === firstTarget.id), 'Suspender e retomar deve preservar a view')

const otherOrigins = new Map([...origins].filter(([id]) => id !== firstTarget.id))
await evaluate(shell, `window.coreDesk.whatsapp.reloadProfile(${JSON.stringify(first.id)})`)
await sleep(3500)
const afterReload = await targetList()
for (const [id, origin] of otherOrigins) {
  const target = afterReload.find((item) => item.id === id)
  assert(target && await evaluate(target, 'performance.timeOrigin') === origin, 'Recarregar um perfil não pode afetar os demais')
}

for (const [name, clearSession] of [['Temporário preservar', false], ['Temporário apagar', true]]) {
  const temporary = await evaluate(shell, `window.coreDesk.whatsapp.createProfile({ name: ${JSON.stringify(name)}, accentColor: '#64748b', iconToken: 'initials' })`)
  await sleep(500)
  await evaluate(shell, `window.coreDesk.whatsapp.removeProfile(${JSON.stringify(temporary.id)}, ${clearSession})`)
}
snapshot = await evaluate(shell, 'window.coreDesk.whatsapp.listProfiles()')
assert(snapshot.profiles.length === 3, 'Remoções de teste não podem afetar os três perfis principais')

await evaluate(shell, `window.coreDesk.whatsapp.openProfile(${JSON.stringify(first.id)})`)
await sleep(1000)
const finalTabs = await evaluate(shell, `([...document.querySelectorAll('[role="tab"]')].filter((element) => element.textContent.includes('Atendimento') || element.textContent.includes('Comercial') || element.textContent.includes('Operações')).length)`)
assert(finalTabs === 3, 'Os três perfis devem aparecer nas abas superiores')

console.log(JSON.stringify({
  profiles: snapshot.profiles.map(({ id, name, partition, accentColor, icon, order }) => ({ id, name, partition, accentColor, icon, order })),
  whatsappViews: (await targetList()).filter((target) => target.type === 'page' && target.url.includes('web.whatsapp.com')).length,
  assertions: [
    'partitions isoladas', 'três páginas oficiais carregadas', 'troca sem reload', 'rename preservou partition',
    'cor e ordem atualizadas', 'fechar/reabrir preservou view', 'suspender/retomar preservou view',
    'reload isolado', 'remoção com e sem limpeza',
  ],
}, null, 2))
