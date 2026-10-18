import { describe, expect, it } from 'vitest'
import fontsCss from './fonts.css?raw'
import tokensCss from './tokens.css?raw'

// Vite-only APIs (no Node typings in the app tsconfig): files are read as raw text; a WOFF2 file starts with the ASCII magic "wOF2".
const fontFiles = import.meta.glob('./fonts/*.woff2', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const licenses = import.meta.glob('../../LICENSES/FONT-*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const licenseByFamily: Record<string, string> = { 'El Messiri': 'FONT-EL-MESSIRI-OFL.txt', Nunito: 'FONT-NUNITO-OFL.txt', Rubik: 'FONT-RUBIK-OFL.txt' }

describe('local fonts', () => {
  const declared = [...fontsCss.matchAll(/url\('\.\/fonts\/([^']+)'\)/g)].map(match => match[1]!)
  const families = [...new Set([...fontsCss.matchAll(/font-family:\s*'([^']+)'/g)].map(match => match[1]!))]

  it('declares only bundled woff2 files that exist and are real woff2', () => {
    expect(declared.length).toBeGreaterThan(0)
    for (const file of declared) {
      const content = fontFiles['./fonts/' + file]
      expect(content, file).toBeTruthy()
      expect(content!.slice(0, 4), file).toBe('wOF2')
    }
    expect(fontsCss).not.toMatch(/https?:\/\//)
  })

  it('does not leave unused font files in the folder', () => {
    expect(Object.keys(fontFiles).map(path => path.replace('./fonts/', '')).sort()).toEqual([...new Set(declared)].sort())
  })

  it('ships a Cyrillic face for every family that sets Russian text', () => {
    for (const family of ['El Messiri', 'Nunito']) {
      expect(declared.some(file => file.startsWith(family.toLowerCase().replace(' ', '-') + '-cyrillic')), family).toBe(true)
    }
  })

  it('keeps an OFL license text for every bundled family', () => {
    for (const family of families) {
      const name = licenseByFamily[family]
      expect(name, `license mapping for ${family}`).toBeTruthy()
      expect(licenses['../../LICENSES/' + name!], family).toContain('SIL OPEN FONT LICENSE')
    }
  })

  it('points every font token at a declared family first', () => {
    for (const token of ['--font-display', '--font-ui', '--font-num']) {
      const match = tokensCss.match(new RegExp(token + ":\\s*'([^']+)'"))
      expect(match, token).toBeTruthy()
      expect(families, token).toContain(match![1])
    }
  })
})

describe('design tokens', () => {
  it('keeps the legacy aliases that existing components still use', () => {
    for (const token of ['--display', '--ink', '--muted', '--gold', '--line', '--panel']) expect(tokensCss, token).toContain(token + ':')
  })

  it('defines soft shapes only: no zero or sharp radius tokens', () => {
    for (const [, value] of tokensCss.matchAll(/--(?:r|shape)-[a-z0-9-]+:\s*([^;]+);/g)) expect(value).not.toMatch(/(^|\s)0(px|rem)?(\s|$)/)
    expect(tokensCss).not.toContain('clip-path')
  })
})
