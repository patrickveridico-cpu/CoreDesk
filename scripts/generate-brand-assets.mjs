import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = process.cwd()
const source = path.join(root, 'assets', 'brand', 'CoreDesk-logo-conceito.png')
const output = path.join(root, 'assets', 'brand', 'derived')
const iconSizes = [16, 24, 32, 48, 64, 128, 256]
await mkdir(output, { recursive: true })

const metadata = await sharp(source).metadata()
if (metadata.width !== 1536 || metadata.height !== 1024) {
  throw new Error(`Dimensões inesperadas para a arte oficial: ${metadata.width}x${metadata.height}`)
}

const symbolMaster = path.join(output, 'coredesk-symbol-512.png')
await sharp(source)
  .extract({ left: 512, top: 84, width: 512, height: 512 })
  .png()
  .toFile(symbolMaster)

const iconFiles = []
for (const size of iconSizes) {
  const target = path.join(output, `coredesk-symbol-${size}.png`)
  await sharp(symbolMaster).resize(size, size, { fit: 'contain' }).png().toFile(target)
  iconFiles.push(target)
}

for (const width of [384, 768]) {
  await sharp(source).resize({ width, withoutEnlargement: true }).png().toFile(path.join(output, `coredesk-full-${width}.png`))
}

const ico = await pngToIco(iconFiles)
await writeFile(path.join(root, 'assets', 'brand', 'coredesk.ico'), ico)

const original = await readFile(source)
console.log(JSON.stringify({ sourceBytes: original.length, iconSizes, symbolCrop: { left: 512, top: 84, width: 512, height: 512 } }, null, 2))
