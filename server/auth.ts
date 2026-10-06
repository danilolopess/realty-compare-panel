import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { compare, hash } from 'bcryptjs'
import { getConfigValue, setConfigValue } from './config'
import { resolvePasswordHash } from './password-hash'

const DUMMY_HASH =
  '$2b$12$ZnMqsMgbvt1D1D22TB1mP.k689N/YWr6db3UVjpJG9ws1DRnM5uOu'
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5
const BCRYPT_COST = 12
export const MIN_PASSWORD_LENGTH = 8
const CONFIG_PASSWORD_HASH = 'password_hash'

const attempts = new Map<string, { count: number; resetAt: number }>()
let avisouEmail = false

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function allowedEmail(): string | null {
  const raw = process.env.AUTH_EMAIL?.trim()
  if (!raw) {
    if (!avisouEmail) {
      avisouEmail = true
      console.error('AUTH_EMAIL não definido')
    }
    return null
  }
  return normalizeEmail(raw)
}

export function emailsMatch(input: string, allowed: string): boolean {
  const left = Buffer.from(normalizeEmail(input))
  const right = Buffer.from(normalizeEmail(allowed))
  if (left.length !== right.length) {
    timingSafeEqual(left, Buffer.alloc(left.length))
    return false
  }
  return timingSafeEqual(left, right)
}

export async function credentialsOk(email: string, password: string): Promise<boolean> {
  const allowed = allowedEmail()
  const emailOk = allowed !== null && emailsMatch(email, allowed)
  const dbHash = await getConfigValue(CONFIG_PASSWORD_HASH)
  const configured = resolvePasswordHash(dbHash, process.env.AUTH_PASSWORD_HASH)
  if (process.env.AUTH_PASSWORD_HASH?.trim() && !configured && !dbHash) {
    console.error(
      'AUTH_PASSWORD_HASH must be the base64 line from scripts/hash-password.mjs',
    )
  }
  const hashToCheck = emailOk && configured ? configured : DUMMY_HASH
  let passwordOk = false
  try {
    passwordOk = await compare(password, hashToCheck)
  } catch {
    passwordOk = false
  }
  return emailOk && Boolean(configured) && passwordOk
}

export async function verifyCurrentPassword(password: string): Promise<boolean> {
  const dbHash = await getConfigValue(CONFIG_PASSWORD_HASH)
  const configured = resolvePasswordHash(dbHash, process.env.AUTH_PASSWORD_HASH)
  if (!configured) return false
  try {
    return await compare(password, configured)
  } catch {
    return false
  }
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; reason: 'mismatch' | 'weak' | 'confirm' | 'db' }

export async function changeStoredPassword(
  current: string,
  next: string,
  confirm: string,
): Promise<ChangePasswordResult> {
  if (next.length < MIN_PASSWORD_LENGTH) return { ok: false, reason: 'weak' }
  if (next !== confirm) return { ok: false, reason: 'confirm' }
  const matches = await verifyCurrentPassword(current)
  if (!matches) return { ok: false, reason: 'mismatch' }
  const hashed = await hash(next, BCRYPT_COST)
  const saved = await setConfigValue(CONFIG_PASSWORD_HASH, hashed)
  return saved ? { ok: true } : { ok: false, reason: 'db' }
}

export function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for']
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded
  if (raw) {
    const first = raw.split(',')[0]?.trim()
    if (first) return first
  }
  const real = req.headers['x-real-ip']
  if (typeof real === 'string' && real.trim()) return real.trim()
  return req.socket.remoteAddress || 'local'
}

export function isLoginRateLimited(ip: string): boolean {
  const rec = attempts.get(ip)
  if (!rec) return false
  if (rec.resetAt <= Date.now()) {
    attempts.delete(ip)
    return false
  }
  return rec.count >= MAX_ATTEMPTS
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now()
  const rec = attempts.get(ip)
  if (!rec || rec.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return
  }
  rec.count += 1
}

export function clearLoginFailures(ip: string): void {
  attempts.delete(ip)
}
