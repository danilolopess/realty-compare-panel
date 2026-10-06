import type { Plugin } from 'vite'
import { resolverOg } from './deploy/og.mjs'

interface Req {
  url?: string
  method?: string
}
interface Res {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: string): void
}

function enviar(res: Res, status: number, image: string | null) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ image }))
}

function handler(req: Req, res: Res, next: () => void) {
  const caminho = (req.url ?? '').split('?')[0]
  if (caminho !== '/api/og') {
    next()
    return
  }
  if (req.method !== 'GET') {
    enviar(res, 405, null)
    return
  }
  const pedido = new URL(req.url ?? '', 'http://localhost')
  void resolverOg(pedido.searchParams.get('url') ?? '').then(
    (resultado) => enviar(res, resultado.status, resultado.image),
    () => enviar(res, 502, null),
  )
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
