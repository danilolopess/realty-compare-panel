import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgres://user:pass@127.0.0.1:5432/imoveis',
  max: 4,
  connectionTimeoutMillis: 3000,
})

let preparado: Promise<void> | null = null

export function prepararAuth(): Promise<void> {
  if (preparado) return preparado
  const sql = readFileSync(resolve(process.cwd(), 'docker/auth.sql'), 'utf8')
  const pendente = pool
    .query(sql)
    .then(() => undefined)
    .catch((err: unknown) => {
      preparado = null
      throw err
    })
  preparado = pendente
  return pendente
}

export async function query<T extends pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<{ ok: true; rows: T[] } | { ok: false }> {
  try {
    await prepararAuth()
    const result = await pool.query<T>(text, params)
    return { ok: true, rows: result.rows }
  } catch (err) {
    console.error(err)
    return { ok: false }
  }
}
