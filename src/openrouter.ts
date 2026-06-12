// Cliente mínimo para a API de chat do OpenRouter (compatível com OpenAI).
// As chamadas saem direto do browser — o OpenRouter libera CORS para isso.
// A chave é lida de import.meta.env.VITE_OPENROUTER_API_KEY (ver .env).

const ENDPOINT =
  (import.meta.env.VITE_LLM_ENDPOINT as string | undefined) ??
  'https://openrouter.ai/api/v1/chat/completions'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export const MODELO_PADRAO =
  (import.meta.env.VITE_LLM_MODEL as string | undefined) ?? 'gpt-5.4-nano-2026-03-17'

// Modelo SEMPRE usado em consultas AUTOMÁTICAS ao LLM (ex.: geração de
// título da conversa), independente do modelo escolhido no dropdown.
export const MODELO_AUTO = MODELO_PADRAO

// Monta o prompt de sistema embutindo o JSON completo dos imóveis.
// Esse contexto é reenviado em TODA requisição (sem RAG, como combinado).
export function montarSystemPrompt(jsonImoveis: string): string {
  return [
    'You are an assistant that answers questions about a list of real estate properties.',
    'Use EXCLUSIVELY the data provided below as your source of truth.',
    'If the information is not available, say it is not found in the property list.',
    'Always respond in Brazilian Portuguese (pt-BR), objectively. Monetary values in Brazilian reais.',
    'Whenever citing a specific property, use the format "#N" (e.g., "#42").',
    '',
    'LANGUAGE RULES (mandatory in every response):',
    '- Never mention technical field or property names (e.g., "campo custo", "gar=1", "quintal=false", "pet=true", "noPet", \'status: "inviabilizado"\', "custo=null", "iptuEst=true"). Always use natural language.',
    '- Never say "consta no JSON" or "não consta no JSON". Say "consta na lista de imóveis" or "essa informação não está disponível".',
    '- Translate everything for the non-technical user: "garagem" instead of "gar"; "aceita animais de estimação" instead of "pet=true"; "sem quintal" instead of "quintal=false"; "custo mensal não informado" instead of "custo=null"; "IPTU estimado" instead of "iptuEst=true".',
    '',
    'PROPERTY DATA:',
    jsonImoveis,
  ].join('\n')
}

// Helper de baixo nível: dado um modelo e a lista de messages, chama o
// OpenRouter e devolve o texto da resposta. Centraliza apiKey, headers
// (X-Title em ASCII puro!) e tratamento de erro.
async function chamarLLM(modelo: string, messages: ChatMessage[]): Promise<string> {
  const apiKey = import.meta.env.VITE_LLM_API_KEY as string | undefined
  if (!apiKey) {
    throw new Error(
      'Chave da API ausente. Defina VITE_LLM_API_KEY no .env e reinicie o dev server.',
    )
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // Opcionais, mas recomendados pelo OpenRouter para identificar a origem.
      // Headers HTTP só aceitam ISO-8859-1: manter o título em ASCII puro
      // (sem acento/travessão), senão o fetch falha antes de enviar.
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Painel Imoveis Chat',
    },
    body: JSON.stringify({ model: modelo, messages, temperature: 0.25 }),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${res.status}: ${txt || res.statusText}`)
  }

  const data = await res.json()
  const conteudo = data?.choices?.[0]?.message?.content
  if (typeof conteudo !== 'string') {
    throw new Error('Resposta inesperada do OpenRouter (sem conteúdo).')
  }
  return conteudo
}

export async function enviarChat(
  jsonImoveis: string,
  historico: ChatMessage[],
  modelo: string = MODELO_PADRAO,
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: montarSystemPrompt(jsonImoveis) },
    ...historico,
  ]
  return chamarLLM(modelo, messages)
}

// Versão streaming de chamarLLM.
// Envia stream:true; se o modelo não suportar (content-type != text/event-stream),
// faz fallback automático lendo a resposta como JSON normal e yield do conteúdo inteiro.
async function* chamarLLMStream(modelo: string, messages: ChatMessage[]): AsyncGenerator<string> {
  const apiKey = import.meta.env.VITE_LLM_API_KEY as string | undefined
  if (!apiKey) {
    throw new Error(
      'Chave da API ausente. Defina VITE_LLM_API_KEY no .env e reinicie o dev server.',
    )
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Painel Imoveis Chat',
    },
    body: JSON.stringify({ model: modelo, messages, stream: true, temperature: 0.25 }),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${res.status}: ${txt || res.statusText}`)
  }

  const contentType = res.headers.get('content-type') ?? ''

  if (!contentType.includes('text/event-stream')) {
    // Modelo não suporta streaming: fallback para JSON normal.
    const data = await res.json()
    const conteudo = data?.choices?.[0]?.message?.content
    if (typeof conteudo !== 'string') {
      throw new Error('Resposta inesperada do OpenRouter (sem conteúdo).')
    }
    yield conteudo
    return
  }

  // Lê o SSE line-by-line.
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') return
      try {
        const parsed = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] }
        const chunk = parsed.choices?.[0]?.delta?.content
        if (typeof chunk === 'string' && chunk) yield chunk
      } catch {
        // linha malformada — ignora
      }
    }
  }
}

export async function* enviarChatStream(
  jsonImoveis: string,
  historico: ChatMessage[],
  modelo: string = MODELO_PADRAO,
): AsyncGenerator<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: montarSystemPrompt(jsonImoveis) },
    ...historico,
  ]
  yield* chamarLLMStream(modelo, messages)
}

// Gera um título curto para a conversa. SEMPRE usa MODELO_AUTO
// (gemini-3.1-flash-lite), independente do modelo do chat.
export async function gerarTitulo(historico: ChatMessage[]): Promise<string> {
  // A 1ª pergunta + 1ª resposta já bastam para resumir o tema.
  const conversa = historico
    .slice(0, 4)
    .map((m) => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`)
    .join('\n')

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'Generate a short title (3 to 6 words, no quotes, no period) that ' +
        'summarizes the topic of the conversation below. Reply with ONLY the title, in Brazilian Portuguese.',
    },
    { role: 'user', content: conversa },
  ]

  const bruto = await chamarLLM(MODELO_AUTO, messages)
  // Limpeza defensiva: 1ª linha, sem aspas, no máximo 80 chars.
  const limpo = bruto.trim().split('\n')[0].replace(/^["']|["']$/g, '').slice(0, 80)
  return limpo || 'Nova conversa'
}
