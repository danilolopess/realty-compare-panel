// Processo de produção: arquivos do Vite, login em server/routes.ts e /api/og.
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'
import { resolverOg } from '../deploy/og.mjs'
import { json, pathname, prepararLogin, tratar } from './routes'

const DIST = join(process.cwd(), 'dist')
const PORT = Number(process.env.PORT || 8080)

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
}

function caminhoDentro(raiz: string, pedido: string): string | null {
  const relativo = normalize(pedido).replace(/^([/\\])+/, '')
  if (relativo.split(/[/\\]/).includes('..')) return null
  const cheio = join(raiz, relativo)
  const prefixo = raiz.endsWith(sep) ? raiz : raiz + sep
  if (cheio !== raiz && !cheio.startsWith(prefixo)) return null
  return cheio
}

function servirArquivo(res: ServerResponse, arquivo: string): void {
  const tipo = TIPOS[extname(arquivo).toLowerCase()] || 'application/octet-stream'
  const headers: Record<string, string> = { 'Content-Type': tipo }
  if (arquivo.endsWith(`${sep}index.html`)) headers['Cache-Control'] = 'no-cache'
  res.writeHead(200, headers)
  createReadStream(arquivo).pipe(res)
}

function servirEstatico(req: IncomingMessage, res: ServerResponse): void {
  let pedido: URL
  try {
    pedido = new URL(req.url ?? '/', 'http://localhost')
  } catch {
    json(res, 400, { message: 'URL inválida' })
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    json(res, 405, { message: 'método não suportado' })
    return
  }
  const arquivo = caminhoDentro(DIST, pedido.pathname)
  if (!arquivo) {
    json(res, 400, { message: 'caminho inválido' })
    return
  }
  if (existsSync(arquivo) && statSync(arquivo).isFile()) {
    if (req.method === 'HEAD') {
      res.writeHead(200, {
        'Content-Type': TIPOS[extname(arquivo).toLowerCase()] || 'application/octet-stream',
      })
      res.end()
      return
    }
    servirArquivo(res, arquivo)
    return
  }
  if (extname(pedido.pathname)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Não encontrado')
    return
  }
  const indice = join(DIST, 'index.html')
  if (!existsSync(indice)) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Build ausente')
    return
  }
  if (req.method === 'HEAD') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end()
    return
  }
  servirArquivo(res, indice)
}

async function og(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET') {
    json(res, 405, { image: null })
    return
  }
  const pedido = new URL(req.url ?? '/', 'http://localhost')
  const resultado = await resolverOg(pedido.searchParams.get('url') ?? '')
  json(res, resultado.status, { image: resultado.image })
}

function continuar(req: IncomingMessage, res: ServerResponse): void {
  const caminho = pathname(req)
  if (caminho === '/api/og') {
    void og(req, res).catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : err)
      if (!res.headersSent) json(res, 500, { image: null })
    })
    return
  }
  if (caminho.startsWith('/api/')) {
    json(res, 404, { error: 'Não encontrado.' })
    return
  }
  servirEstatico(req, res)
}

prepararLogin()

const servidor = createServer((req, res) => {
  void tratar(req, res, () => continuar(req, res)).catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err)
    if (!res.headersSent) json(res, 500, { error: 'Erro interno.' })
    else res.end()
  })
})

servidor.listen(PORT, '0.0.0.0', () => {
  console.log(`painel ouvindo em :${PORT}`)
})
