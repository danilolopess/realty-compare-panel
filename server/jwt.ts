import { createHmac } from 'node:crypto'

const PAPEL = 'painel_app'
const VALIDADE_SEG = 10 * 60

let cache: { token: string; exp: number; secret: string } | null = null

function b64url(value: string): string {
  return Buffer.from(value).toString('base64url')
}

function assinar(payload: Record<string, unknown>, secret: string): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  const data = `${header}.${body}`
  const sig = createHmac('sha256', secret).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function tokenPostgrest(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must be at least 32 characters')
  }
  const now = Math.floor(Date.now() / 1000)
  if (cache && cache.secret === secret && cache.exp - 60 > now) return cache.token
  const exp = now + VALIDADE_SEG
  const token = assinar({ role: PAPEL, iat: now, exp }, secret)
  cache = { token, exp, secret }
  return token
}
