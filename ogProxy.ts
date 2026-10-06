import type { Plugin } from 'vite'

const LIMITE_BYTES = 128 * 1024
const TIMEOUT_MS = 8000
const MAX_REDIRECIONAMENTOS = 3

interface Req {
  url?: string
  method?: string
}
interface Res {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: string): void
}

function hostBloqueado(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true
  if (h === '0.0.0.0' || h === '::' || h === '::1') return true
  if (/^\d+$/.test(h)) return true

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (ipv4) {
    const a = Number(ipv4[1])
    const b = Number(ipv4[2])
    if ([a, b, Number(ipv4[3]), Number(ipv4[4])].some((n) => n > 255)) return true
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    return false
  }

  if (h.includes(':')) {
    const ini = h.slice(0, 4)
    if (ini.startsWith('fc') || ini.startsWith('fd')) return true
    if (ini.startsWith('fe8') || ini.startsWith('fe9') || ini.startsWith('fea') || ini.startsWith('feb')) return true
  }
  return false
}

function urlPermitida(raw: string): URL | null {
  let alvo: URL
  try {
    alvo = new URL(raw)
  } catch {
    return null
  }
  if (alvo.protocol !== 'http:' && alvo.protocol !== 'https:') return null
  if (!alvo.hostname || hostBloqueado(alvo.hostname)) return null
  return alvo
}

function atributo(tag: string, nome: string): string | null {
  const re = new RegExp(`\\b${nome}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i')
  const m = re.exec(tag)
  const valor = m?.[1] ?? m?.[2] ?? m?.[3]
  if (valor == null) return null
  return valor
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function extraiOgImage(html: string): string | null {
  const metas = html.match(/<meta\b[^>]*>/gi) ?? []
  for (const tag of metas) {
    const prop = (atributo(tag, 'property') ?? atributo(tag, 'name'))?.toLowerCase()
    if (prop !== 'og:image') continue
    const content = atributo(tag, 'content')?.trim()
    if (content) return content
  }
  return null
}

async function lerTrecho(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader()
  const partes: Uint8Array[] = []
  let total = 0
  try {
    while (total < LIMITE_BYTES) {
      const { done, value } = await reader.read()
      if (done || !value) break
      const falta = LIMITE_BYTES - total
      partes.push(value.byteLength > falta ? value.subarray(0, falta) : value)
      total += Math.min(value.byteLength, falta)
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
  const buf = new Uint8Array(total)
  let offset = 0
  for (const parte of partes) {
    buf.set(parte, offset)
    offset += parte.byteLength
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(buf)
}

async function lerHtml(inicial: URL): Promise<string | null> {
  let atual = inicial
  for (let salto = 0; salto <= MAX_REDIRECIONAMENTOS; salto++) {
    const res = await fetch(atual, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PainelImoveis/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) return null
      const proxima = urlPermitida(new URL(loc, atual).href)
      if (!proxima) return null
      atual = proxima
      continue
    }
    if (!res.ok || !res.body) return null
    return lerTrecho(res.body)
  }
  return null
}

function enviar(res: Res, status: number, image: string | null) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ image }))
}

function handler(req: Req, res: Res, next: () => void) {
  const bruto = req.url ?? ''
  const caminho = bruto.split('?')[0]
  if (caminho !== '/api/og') {
    next()
    return
  }
  if (req.method !== 'GET') {
    enviar(res, 405, null)
    return
  }
  void responder(req, res)
}

async function responder(req: Req, res: Res) {
  const pedido = new URL(req.url ?? '', 'http://localhost')
  const alvo = urlPermitida(pedido.searchParams.get('url') ?? '')
  if (!alvo) {
    enviar(res, 400, null)
    return
  }
  try {
    const html = await lerHtml(alvo)
    const bruto = html ? extraiOgImage(html) : null
    if (!bruto) {
      enviar(res, 200, null)
      return
    }
    const absoluta = new URL(bruto, alvo)
    if (absoluta.protocol !== 'http:' && absoluta.protocol !== 'https:') {
      enviar(res, 200, null)
      return
    }
    enviar(res, 200, absoluta.href)
  } catch {
    enviar(res, 502, null)
  }
}

export function ogImagePlugin(): Plugin {
  return {
    name: 'og-image',
    configureServer(server) {
      server.middlewares.use(handler as never)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler as never)
    },
  }
}
