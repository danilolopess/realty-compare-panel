import type { IncomingMessage, ServerResponse } from 'node:http'
import { loadEnv, type Plugin, type PreviewServer, type ViteDevServer } from 'vite'
import { json, prepararLogin, tratar } from './routes'

function aplicarEnv(server: ViteDevServer | PreviewServer): void {
  const env = loadEnv(server.config.mode, server.config.envDir, '')
  for (const [chave, valor] of Object.entries(env)) {
    if (process.env[chave] === undefined) process.env[chave] = valor
  }
}

function anexar(server: ViteDevServer | PreviewServer): void {
  aplicarEnv(server)
  prepararLogin()
  server.middlewares.use((req, res, next) => {
    void tratar(req as IncomingMessage, res as ServerResponse, next).catch((err: unknown) => {
      console.error(err)
      json(res as ServerResponse, 500, { error: 'Erro interno.' })
    })
  })
}

export function authPlugin(): Plugin {
  return {
    name: 'painel-auth',
    configureServer(server) {
      anexar(server)
    },
    configurePreviewServer(server) {
      anexar(server)
    },
  }
}
