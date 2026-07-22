import WebSocket from 'ws'

const endpoint = process.env.COREDESK_CDP_URL ?? 'http://127.0.0.1:9223'
const list = await fetch(`${endpoint}/json/list`).then((response) => response.json())
const shell = list.find((target) => target.title === 'CoreDesk')
if (!shell) throw new Error('Shell CoreDesk não encontrado')

function evaluate(expression) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(shell.webSocketDebuggerUrl)
    const id = 1
    socket.once('open', () => socket.send(JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: { expression, returnByValue: true },
    })))
    socket.on('message', (buffer) => {
      const message = JSON.parse(buffer.toString())
      if (message.id !== id) return
      socket.close()
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result.result.value)
    })
    socket.once('error', reject)
  })
}

const persisted = JSON.parse(await evaluate(`localStorage.getItem('coredesk-workspace')`)).state
const webTargets = list.filter((target) => target.type === 'page' && target.id !== shell.id)
if (!webTargets.some((target) => target.url.includes('google.com/maps'))) throw new Error('Maps não foi restaurado')
if (!webTargets.some((target) => target.url.includes('example.com'))) throw new Error('Página de teste não foi restaurada')
if (persisted.activeTabId !== 'app-maps') throw new Error('A aba Maps não foi restaurada como ativa')

console.log(JSON.stringify({
  activeTabId: persisted.activeTabId,
  persistedWebTabs: persisted.tabs.filter((tab) => tab.type === 'web').length,
  liveWebContents: webTargets.length,
  urls: webTargets.map((target) => target.url),
}, null, 2))

if (process.argv.includes('--close')) await evaluate('window.coreDesk.window.close()')
