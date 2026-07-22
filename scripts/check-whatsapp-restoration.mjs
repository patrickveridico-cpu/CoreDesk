import WebSocket from 'ws'

const endpoint = process.env.COREDESK_CDP_URL ?? 'http://127.0.0.1:9231'
const targets = await fetch(`${endpoint}/json/list`).then((response) => response.json())
const shell = targets.find((target) => target.title === 'CoreDesk')
if (!shell) throw new Error('Shell CoreDesk não encontrado')

function evaluate(expression) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(shell.webSocketDebuggerUrl)
    const id = 1
    socket.once('open', () => socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } })))
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

const snapshot = await evaluate('window.coreDesk.whatsapp.listProfiles()')
const whatsappViews = targets.filter((target) => target.type === 'page' && target.url.includes('web.whatsapp.com'))
if (snapshot.profiles.length !== 3 || whatsappViews.length !== 3) throw new Error('Perfis ou views não foram restaurados')
if (new Set(snapshot.profiles.map((profile) => profile.partition)).size !== 3) throw new Error('Partitions restauradas não são únicas')

console.log(JSON.stringify({ activeProfileId: snapshot.activeProfileId, profiles: snapshot.profiles.map((profile) => ({ id: profile.id, name: profile.name, partition: profile.partition, open: profile.open })), whatsappViews: whatsappViews.length }, null, 2))
if (process.argv.includes('--close')) await evaluate('window.coreDesk.window.close()')
