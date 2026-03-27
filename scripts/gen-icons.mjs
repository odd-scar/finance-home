import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '../public')

// Icon SVG — designed natively at 512×512, pure paths (no text/font deps).
// The dollar sign is drawn as a path so it renders crisply at every size.
const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <!-- Background with rounded corners -->
  <rect width="512" height="512" rx="${Math.round(size * 0.22)}" fill="#4f46e5"/>

  <!-- Subtle inner gradient overlay -->
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${Math.round(size * 0.22)}" fill="url(#g)"/>

  <!-- Dollar sign — centre vertical bar -->
  <rect x="238" y="80" width="36" height="352" rx="18" fill="white"/>

  <!-- Dollar sign — top crossbar (upper arc of S) -->
  <path d="M 256 152
    C 196 152 152 182 152 228
    C 152 270 188 292 240 308
    L 272 318
    C 316 332 344 350 344 388
    C 344 430 304 458 248 460
    C 192 460 148 432 140 396"
    fill="none" stroke="white" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- Dollar sign — bottom arc continuation -->
  <path d="M 256 152
    C 312 152 360 178 368 216"
    fill="none" stroke="white" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

const sizes = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png',         size: 192 },
  { file: 'icon-512.png',         size: 512 },
]

for (const { file, size } of sizes) {
  const outPath = resolve(publicDir, file)
  await sharp(Buffer.from(svg(size)))
    .png()
    .toFile(outPath)
  console.log(`✓  ${file}  (${size}×${size})`)
}

// Also write the favicon SVG at crisp 32×32
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#4f46e5"/>
  <rect x="14.5" y="5" width="3" height="22" rx="1.5" fill="white"/>
  <path d="M16 9.5 C12 9.5 9 11.5 9 14.5 C9 17.2 11.5 18.5 15 19.5 L17 20.2 C20 21.2 22 22.3 22 24.8 C22 27.5 19.5 29 16 29 C12.5 29 9.8 27.2 9.5 24.8"
    fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M16 9.5 C19.5 9.5 22 11 22.5 13.5"
    fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
</svg>`
writeFileSync(resolve(publicDir, 'favicon.svg'), faviconSvg)
console.log('✓  favicon.svg')
console.log('\nAll icons generated.')
