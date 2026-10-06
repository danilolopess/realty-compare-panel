import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  allowedEmail,
  changeStoredPassword,
  clearLoginFailures,
  clientIp,
  credentialsOk,
  isLoginRateLimited,
  MIN_PASSWORD_LENGTH,
  recordLoginFailure,
  type ChangePasswordResult,
} from './auth'
import { prepararAuth } from './db'
import { tokenPostgrest } from './jwt'
import { getSession, segredoOk } from './session'

const LIMITE_JSON = 32_768
const LIMITE_PROXY = 2 * 1024 * 1024
const CABECALHOS_PEDIDO = [
  'accept',
  'content-type',
  'prefer',
  'range',
  'accept-profile',
  'content-profile',
]
const CABECALHOS_RESPOSTA = [
  'content-type',
  'content-range',
  'content-location',
  'location',
  'preference-applied',
]
const AVISO_SEGREDO = 'Defina AUTH_SECRET no .env (mínimo 32 caracteres) e reinicie o servidor.'

export function pathname(req: IncomingMessage): string {
  const raw = req.url ?? '/'
  const q = raw.indexOf('?')
  return q === -1 ? raw : raw.slice(0, q)
}

export function json(res: ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function redirecionar(res: ServerResponse, location: string): void {
  res.statusCode = 302
  res.setHeader('Location', location)
  res.setHeader('Cache-Control', 'no-store')
  res.end()
}

function texto(res: ServerResponse, status: number, body: string): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

async function lerCorpo(req: IncomingMessage, limite: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buf.length
    if (total > limite) throw new Error('body')
    chunks.push(buf)
  }
  return Buffer.concat(chunks)
}

async function lerJson(req: IncomingMessage): Promise<unknown> {
  const text = (await lerCorpo(req, LIMITE_JSON)).toString('utf8').trim()
  if (!text) return {}
  return JSON.parse(text) as unknown
}

function campo(body: unknown, chave: string): string {
  if (!body || typeof body !== 'object') return ''
  const valor = (body as Record<string, unknown>)[chave]
  return typeof valor === 'string' ? valor : ''
}

function pedidoHtml(req: IncomingMessage, path: string): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  if (
    path.startsWith('/api/') ||
    path.startsWith('/@') ||
    path.startsWith('/src/') ||
    path.startsWith('/node_modules/')
  ) {
    return false
  }
  if (/\.[a-zA-Z0-9]+$/.test(path)) return false
  const accept = req.headers.accept ?? ''
  return accept.includes('text/html')
}

function mensagemSenha(reason: Exclude<ChangePasswordResult, { ok: true }>['reason']): {
  status: number
  error: string
} {
  switch (reason) {
    case 'weak':
      return {
        status: 400,
        error: `A nova senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      }
    case 'confirm':
      return { status: 400, error: 'A confirmação não coincide.' }
    case 'mismatch':
      return { status: 401, error: 'A senha atual está incorreta.' }
    case 'db':
      return { status: 500, error: 'Não foi possível salvar a senha.' }
    default: {
      const exhausted: never = reason
      return { status: 500, error: exhausted }
    }
  }
}

async function encaminharPostgrest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const origem = new URL(req.url ?? '/', 'http://localhost')
  let caminho = origem.pathname.replace(/^\/api\/db/, '')
  if (caminho === '') caminho = '/'
  if (!caminho.startsWith('/')) caminho = `/${caminho}`
  if (caminho.split('/').includes('..')) {
    json(res, 400, { message: 'caminho inválido' })
    return
  }

  const base = process.env.POSTGREST_URL || 'http://127.0.0.1:3000'
  const destino = new URL(base)
  destino.pathname = caminho
  destino.search = origem.search

  const headers = new Headers()
  for (const nome of CABECALHOS_PEDIDO) {
    const valor = req.headers[nome]
    if (typeof valor === 'string') headers.set(nome, valor)
  }
  headers.set('authorization', `Bearer ${tokenPostgrest()}`)

  const comCorpo = req.method !== 'GET' && req.method !== 'HEAD'
  let body: Blob | undefined
  if (comCorpo) {
    try {
      const bruto = await lerCorpo(req, LIMITE_PROXY)
      body = new Blob([new Uint8Array(bruto)])
    } catch {
      json(res, 413, { message: 'corpo grande demais' })
      return
    }
  }

  let upstream: Response
  try {
    upstream = await fetch(destino, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    })
  } catch (err) {
    console.error('proxy', caminho, err instanceof Error ? err.message : err)
    json(res, 502, { message: 'PostgREST indisponível.' })
    return
  }

  const resposta: Record<string, string> = {}
  for (const nome of CABECALHOS_RESPOSTA) {
    const valor = upstream.headers.get(nome)
    if (valor) resposta[nome] = valor
  }
  const buf = Buffer.from(await upstream.arrayBuffer())
  res.writeHead(upstream.status, resposta)
  res.end(buf)
}

async function exigirSessao(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const session = await getSession(req, res)
  if (session.isLoggedIn === true) return true
  json(res, 401, { error: 'Sessão expirada.' })
  return false
}

export async function tratar(
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
): Promise<void> {
  const path = pathname(req)
  const method = req.method ?? 'GET'

  if (!segredoOk()) {
    if (path.startsWith('/api/')) {
      json(res, 500, { error: AVISO_SEGREDO })
      return
    }
    if (pedidoHtml(req, path)) {
      texto(res, 500, AVISO_SEGREDO)
      return
    }
    next()
    return
  }

  if (path === '/api/session' && method === 'GET') {
    const session = await getSession(req, res)
    if (session.isLoggedIn === true) {
      json(res, 200, { loggedIn: true, email: session.email ?? '' })
      return
    }
    json(res, 200, { loggedIn: false })
    return
  }

  if (path === '/api/login' && method === 'POST') {
    const ip = clientIp(req)
    if (isLoginRateLimited(ip)) {
      json(res, 429, { error: 'Muitas tentativas. Espere uns minutos.' })
      return
    }
    let body: unknown
    try {
      body = await lerJson(req)
    } catch {
      json(res, 400, { error: 'Pedido inválido.' })
      return
    }
    const ok = await credentialsOk(campo(body, 'email'), campo(body, 'password'))
    if (!ok) {
      recordLoginFailure(ip)
      json(res, 401, { error: 'Email ou senha inválidos.' })
      return
    }
    clearLoginFailures(ip)
    const session = await getSession(req, res)
    const email = allowedEmail()
    if (!email) {
      json(res, 500, { error: 'AUTH_EMAIL não definido.' })
      return
    }
    session.isLoggedIn = true
    session.email = email
    await session.save()
    json(res, 200, { ok: true })
    return
  }

  if (path === '/api/logout' && method === 'POST') {
    const session = await getSession(req, res)
    session.destroy()
    json(res, 200, { ok: true })
    return
  }

  if (path === '/api/password' && method === 'POST') {
    if (!(await exigirSessao(req, res))) return
    const ip = clientIp(req)
    if (isLoginRateLimited(ip)) {
      json(res, 429, { error: 'Muitas tentativas. Espere uns minutos.' })
      return
    }
    let body: unknown
    try {
      body = await lerJson(req)
    } catch {
      json(res, 400, { error: 'Pedido inválido.' })
      return
    }
    const result = await changeStoredPassword(
      campo(body, 'current'),
      campo(body, 'next'),
      campo(body, 'confirm'),
    )
    if (result.ok) {
      clearLoginFailures(ip)
      json(res, 200, { ok: 'Senha atualizada.' })
      return
    }
    recordLoginFailure(ip)
    const mensagem = mensagemSenha(result.reason)
    json(res, mensagem.status, { error: mensagem.error })
    return
  }

  if (path === '/api/db' || path.startsWith('/api/db/')) {
    if (!(await exigirSessao(req, res))) return
    await encaminharPostgrest(req, res)
    return
  }

  if (path === '/api/og') {
    if (!(await exigirSessao(req, res))) return
    next()
    return
  }

  if (path.startsWith('/api/')) {
    next()
    return
  }

  if (pedidoHtml(req, path)) {
    const session = await getSession(req, res)
    const logado = session.isLoggedIn === true
    if (path === '/login' || path === '/login/') {
      if (logado) redirecionar(res, '/')
      else next()
      return
    }
    if (!logado) {
      redirecionar(res, '/login')
      return
    }
  }

  next()
}

export function prepararLogin(): void {
  void prepararAuth().catch((err: unknown) => {
    console.error('Não foi possível preparar o login no Postgres:', err)
  })
}
