import { query } from './db'

export async function getConfigValue(chave: string): Promise<string | undefined> {
  const result = await query<{ valor: string }>(
    'SELECT valor FROM auth.painel_config WHERE chave = $1',
    [chave],
  )
  if (!result.ok) return undefined
  return result.rows[0]?.valor
}

export async function setConfigValue(chave: string, valor: string): Promise<boolean> {
  const result = await query(
    `INSERT INTO auth.painel_config (chave, valor, atualizado_em)
     VALUES ($1, $2, now())
     ON CONFLICT (chave) DO UPDATE
       SET valor = EXCLUDED.valor, atualizado_em = now()`,
    [chave, valor],
  )
  return result.ok
}
