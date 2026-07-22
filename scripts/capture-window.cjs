const { app, desktopCapturer } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

app.whenReady().then(async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 1440, height: 900 },
  })
  const source = sources.find((item) => item.name === 'CoreDesk')
  if (!source) throw new Error('Janela CoreDesk não encontrada')
  const fileName = process.env.COREDESK_CAPTURE_NAME || 'coredesk-web-tab.png'
  fs.writeFileSync(path.join(process.cwd(), fileName), source.thumbnail.toPNG())
  app.quit()
})
