import { createReadStream, existsSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'
import { resolverOg } from '../deploy/og.mjs'
import { json } from './routes'

const DIST = join(process.cwd(), 'dist')

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

export async function servirPublico(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const pedido = new URL(req.url ?? '/', 'http://localhost')

  if (pedido.pathname === '/api/og') {
    if (req.method !== 'GET') {
      json(res, 405, { image: null })
      return
    }
    const resultado = await resolverOg(pedido.searchParams.get('url') ?? '')
    json(res, resultado.status, { image: resultado.image })
    return
  }

  if (pedido.pathname.startsWith('/api/')) {
    json(res, 404, { message: 'Não encontrado' })
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
