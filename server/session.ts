import type { IncomingMessage, ServerResponse } from 'node:http'
import { getIronSession, type SessionOptions } from 'iron-session'

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 60

export type SessionData = {
  isLoggedIn: boolean
  email: string
}

export function segredoOk(): boolean {
  const password = process.env.AUTH_SECRET
  return typeof password === 'string' && password.length >= 32
}

export function getSessionOptions(): SessionOptions {
  const password = process.env.AUTH_SECRET
  if (!password || password.length < 32) {
    throw new Error('AUTH_SECRET must be at least 32 characters')
  }
  return {
    cookieName: 'painel_session',
    password,
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    },
  }
}

export function getSession(req: IncomingMessage, res: ServerResponse) {
  return getIronSession<SessionData>(req, res, getSessionOptions())
}
