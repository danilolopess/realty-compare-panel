#!/usr/bin/env node
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { hash } from 'bcryptjs'

const COST = 12
const fromArg = process.argv.slice(2).join(' ').trim()

let password = fromArg
if (!password) {
  const rl = createInterface({ input, output })
  password = (await rl.question('Nova senha: ')).trim()
  rl.close()
}

if (!password) {
  console.error('Senha vazia.')
  process.exit(1)
}

const hashed = await hash(password, COST)
console.log(`AUTH_PASSWORD_HASH=${Buffer.from(hashed, 'utf8').toString('base64')}`)
