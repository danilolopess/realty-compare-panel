// Roda o build do Vite com as VITE_* do secret montado. Não imprime valores.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const env = { ...process.env }
const texto = readFileSync('/run/secrets/appenv', 'utf8')
for (const linha of texto.split('\n')) {
  const t = linha.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i < 1) continue
  const chave = t.slice(0, i).trim()
  if (!chave.startsWith('VITE_')) continue
  let valor = t.slice(i + 1).trim()
  if (
    (valor.startsWith('"') && valor.endsWith('"') && valor.length >= 2) ||
    (valor.startsWith("'") && valor.endsWith("'") && valor.length >= 2)
  ) {
    valor = valor.slice(1, -1)
  }
  env[chave] = valor
}
if (!env.VITE_LLM_API_KEY) {
  console.error('VITE_LLM_API_KEY ausente no .env. O build de produção não continua.')
  process.exit(1)
}
const resultado = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', env })
process.exit(resultado.status === null ? 1 : resultado.status)
