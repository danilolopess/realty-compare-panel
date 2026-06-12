import { gerarJsonImoveis } from './data'
import { enviarChat } from './openrouter'
import type { ChatMessage } from './openrouter'

export interface PromptConfig {
  id: string
  titulo: string
  descricao: string
  prompt?: string
  promptTemplate?: string
}

export async function carregarPromptConfig(id: string): Promise<PromptConfig> {
  const res = await fetch(`/prompts/ranking-${id}.json`)
  if (!res.ok) throw new Error(`Configuração de prompt não encontrada (${res.status})`)
  return res.json() as Promise<PromptConfig>
}

export async function gerarRanking(
  config: PromptConfig,
  userInput?: string,
): Promise<string> {
  const json = await gerarJsonImoveis()
  const jsonStr = JSON.stringify(json, null, 2)

  let promptText: string
  if (config.promptTemplate !== undefined && userInput !== undefined) {
    promptText = config.promptTemplate.replace('{USER_INPUT}', userInput)
  } else if (config.prompt !== undefined) {
    promptText = config.prompt
  } else {
    throw new Error('Configuração de prompt inválida: campo prompt ou promptTemplate ausente.')
  }

  const historico: ChatMessage[] = [{ role: 'user', content: promptText }]
  return enviarChat(jsonStr, historico)
}
