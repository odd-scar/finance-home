// Pure Node.js PNG icon generator — no dependencies required
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

// CRC32 table
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const t = Buffer.from(type)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

function createIcon(size) {
  // Colors: brand purple bg (#6366f1 = 99,102,241), white symbol area
  const R = 99, G = 102, B = 241

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // color type: RGB
  // compression, filter, interlace = 0

  // Build raw scanlines: [filter_byte=0, R, G, B, R, G, B, ...]
  const raw = Buffer.alloc(size * (1 + size * 3))
  const cx = size / 2, cy = size / 2
  const outerR = size * 0.42    // rounded square approximation via circle
  const dollarW = size * 0.06   // vertical bar width of $ sign
  const dollarH = size * 0.5    // height of $ sign

  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3)
    raw[row] = 0 // filter none
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy
      // Rounded square: use superellipse approximation
      const inBg = Math.pow(Math.abs(dx) / outerR, 4) + Math.pow(Math.abs(dy) / outerR, 4) <= 1

      let pr = R, pg = G, pb = B // default: transparent (purple bg)

      if (!inBg) {
        // Outside icon shape — dark background to blend
        pr = 17; pg = 18; pb = 23  // gray-950 ~#111217
      } else {
        // Inside rounded square — draw white $ symbol
        const relX = dx / size, relY = dy / size

        // Vertical bar of $
        const inBar = Math.abs(relX) < 0.05 && Math.abs(relY) < 0.28

        // Top arc of $ (upper S curve)
        const topArcDist = Math.sqrt(Math.pow(relX - 0.06, 2) + Math.pow(relY + 0.1, 2))
        const inTopArc = topArcDist > 0.1 && topArcDist < 0.17 && relY < -0.03 && relX > -0.12

        // Bottom arc of $ (lower S curve)
        const botArcDist = Math.sqrt(Math.pow(relX + 0.06, 2) + Math.pow(relY - 0.1, 2))
        const inBotArc = botArcDist > 0.1 && botArcDist < 0.17 && relY > 0.03 && relX < 0.12

        if (inBar || inTopArc || inBotArc) {
          pr = 255; pg = 255; pb = 255  // white
        }
      }

      raw[row + 1 + x * 3] = pr
      raw[row + 1 + x * 3 + 1] = pg
      raw[row + 1 + x * 3 + 2] = pb
    }
  }

  const idat = chunk('IDAT', zlib.deflateSync(raw))
  const iend = chunk('IEND', Buffer.alloc(0))
  return Buffer.concat([sig, chunk('IHDR', ihdr), idat, iend])
}

const publicDir = path.join(__dirname, '..', 'public')
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true })

for (const size of [192, 512]) {
  const png = createIcon(size)
  const out = path.join(publicDir, `icon-${size}.png`)
  fs.writeFileSync(out, png)
  console.log(`✓ Created ${out} (${png.length} bytes)`)
}
console.log('Icons generated successfully.')
