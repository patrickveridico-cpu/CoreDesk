import WebSocket from 'ws'

const endpoint = process.env.COREDESK_CDP_URL ?? 'http://127.0.0.1:9223'
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function targets() {
  return fetch(`${endpoint}/json/list`).then((response) => response.json())
}

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
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text)
  return response.result.value
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function pageByUrl(list, fragment) {
  return list.find((target) => target.type === 'page' && target.url.includes(fragment))
}

const results = []
let list = await targets()
const shell = list.find((target) => target.title === 'CoreDesk')
let google = pageByUrl(list, 'google.com/')
let maps = pageByUrl(list, 'google.com/maps')
let example = pageByUrl(list, 'example.com')
assert(shell && google && maps && example, 'Google, Maps, Example e shell devem estar carregados')
results.push('Google, Maps e Example carregados')

const originsBefore = new Map()
for (const target of [google, maps, example]) originsBefore.set(target.id, await evaluate(target, 'performance.timeOrigin'))
for (const label of ['Google', 'Maps', 'Página de teste', 'Início', 'Google']) {
  await evaluate(shell, `([...document.querySelectorAll('[role="tab"]')].find((element) => element.textContent.includes(${JSON.stringify(label)})))?.click()`)
  await sleep(120)
}
list = await targets()
for (const [id, origin] of originsBefore) {
  const target = list.find((item) => item.id === id)
  assert(target && await evaluate(target, 'performance.timeOrigin') === origin, `A view ${id} não deve recarregar ao alternar`)
}
results.push('Troca rápida preservou processos e performance.timeOrigin')

await evaluate(shell, `(() => {
  const input = document.querySelector('input[aria-label="Endereço"]')
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, 'guincho em curitiba')
  input.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await sleep(100)
await evaluate(shell, `document.querySelector('input[aria-label="Endereço"]').form.requestSubmit()`)
await sleep(2500)
list = await targets()
google = list.find((target) => target.id === google.id)
assert(google.url.includes('google.com') && google.url.includes('guincho'), 'Texto comum deve virar busca Google')
results.push('Pesquisa pela barra de endereço concluída')

await evaluate(shell, `window.coreDesk.views.back('app-google')`)
await sleep(800)
await evaluate(shell, `window.coreDesk.views.forward('app-google')`)
await sleep(800)
results.push('Voltar e avançar executados via IPC')

await evaluate(google, `document.cookie = 'coredesk_partition=google; path=/'`)
await evaluate(shell, `window.coreDesk.views.navigate('app-example', 'https://www.google.com')`)
await sleep(2200)
list = await targets()
example = list.find((target) => target.id === example.id)
const cookieBefore = await evaluate(example, 'document.cookie')
assert(!cookieBefore.includes('coredesk_partition=google'), 'Partition de teste não pode compartilhar cookie Google')
await evaluate(example, `document.cookie = 'coredesk_partition=test; path=/'`)
const googleCookie = await evaluate(google, 'document.cookie')
assert(googleCookie.includes('coredesk_partition=google') && !googleCookie.includes('coredesk_partition=test'), 'Partitions devem permanecer isoladas')
await evaluate(shell, `window.coreDesk.views.navigate('app-example', 'https://example.com')`)
await sleep(1200)
results.push('Partitions Google e teste isoladas na mesma origem')

list = await targets()
example = list.find((target) => target.id === example.id)
await evaluate(example, `window.open('https://example.org', '_blank')`)
await sleep(1200)
let afterPopup = await targets()
const popup = pageByUrl(afterPopup, 'example.org')
assert(popup, 'target=_blank deve criar uma aba CoreDesk')
results.push('target=_blank convertido em nova aba')

await evaluate(shell, `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', ctrlKey: true }))`)
await sleep(700)
afterPopup = await targets()
assert(!afterPopup.some((target) => target.id === popup.id), 'Fechar aba deve destruir seu webContents')
results.push('Ctrl+W destruiu a WebContentsView fechada')

await evaluate(shell, `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', ctrlKey: true, shiftKey: true }))`)
await sleep(900)
const restoredTargets = await targets()
assert(pageByUrl(restoredTargets, 'example.org'), 'Ctrl+Shift+T deve restaurar a última aba web')
await evaluate(shell, `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', ctrlKey: true }))`)
await sleep(500)
results.push('Ctrl+Shift+T restaurou a última aba fechada')

await evaluate(shell, `(() => {
  document.querySelector('button[aria-label="Criar aba web"]').click()
})()`)
await sleep(500)
const activeId = await evaluate(shell, `JSON.parse(localStorage.getItem('coredesk-workspace')).state.activeTabId`)
await evaluate(shell, `window.coreDesk.views.navigate(${JSON.stringify(activeId)}, 'https://nonexistent.invalid')`)
await sleep(1800)
const errorText = await evaluate(shell, 'document.body.innerText')
assert(errorText.includes('Não foi possível abrir esta página'), 'Falha deve mostrar tela interna amigável')
results.push('Tela interna de erro exibida sem stack trace')

await evaluate(shell, `([...document.querySelectorAll('[role="tab"]')].find((element) => element.textContent.includes('Início')))?.click()`)
await sleep(300)
const homeVisible = await evaluate(shell, `document.body.innerText.includes('Tudo converge no CoreDesk.')`)
assert(homeVisible, 'Aba interna deve aparecer sem view remota sobreposta')
results.push('Aba interna selecionada e view remota ocultada')

await evaluate(shell, 'window.resizeTo(1100, 700)')
await sleep(300)
const minimumSize = await evaluate(shell, `({ width: window.innerWidth, height: window.innerHeight })`)
assert(minimumSize.width === 1100 && minimumSize.height === 700, 'Janela deve aceitar o mínimo 1100x700')
await evaluate(shell, 'window.coreDesk.window.toggleMaximize()')
await sleep(500)
const maximized = await evaluate(shell, `({ width: window.innerWidth, height: window.innerHeight })`)
assert(maximized.width > minimumSize.width || maximized.height > minimumSize.height, 'Controle próprio deve maximizar')
await evaluate(shell, 'window.coreDesk.window.toggleMaximize()')
await sleep(500)
const restored = await evaluate(shell, `({ width: window.innerWidth, height: window.innerHeight })`)
assert(restored.width === minimumSize.width && restored.height === minimumSize.height, 'Controle próprio deve restaurar')
await evaluate(shell, 'window.resizeTo(1440, 900)')
results.push('Mínimo, maximização e restauração validados')

await evaluate(shell, `([...document.querySelectorAll('[role="tab"]')].find((element) => element.textContent.includes('Maps')))?.click()`)
await sleep(300)

console.log(JSON.stringify({ passed: results.length, results }, null, 2))
