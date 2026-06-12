import type {
  AceitaPet,
  ChatSession,
  ChatSessionMessage,
  ChatSessionResumo,
  FilterState,
  Imovel,
  StatusImovel,
  TipoImovel,
} from './types'

interface DbRow {
  id: number
  tipo_imovel: TipoImovel
  imobiliaria_corretor: string
  bairro: string
  cidade: string
  operacao: string
  aluguel: number
  venda: number | null
  condominio: number
  iptu: number
  iptu_estimado: boolean
  custo_mensal_total: number
  garagem_vagas: number | null
  garagem_detalhe: string
  quintal_tem: boolean | null
  quintal_observacao: string
  quartos: number | null
  banheiros: number | null
  area_m2: number | null
  aceita_pet: AceitaPet
  entrar_em_contato: boolean
  a_verificar: string | null
  observacoes: string
  link: string
  whatsapp: string | null
  status: string | null
  status_changed_at: string | null
  notas: string | null
  favorito: boolean
}

export interface RankingSalvo {
  conteudo: string
  userInput: string | null
  geradoEm: string
}

const API = 'http://localhost:3000'

// Cache das linhas cruas (formato do banco) do último fetchImoveis().
// Usado para exportar o JSON no formato original, sem reconstruir a
// partir do Imovel normalizado (que descarta alguns campos).
const rowsById = new Map<number, DbRow>()

function toImovel(r: DbRow): Imovel {
  const semDados = false
  return {
    n: r.id,
    tipo: r.tipo_imovel,
    corretor: r.imobiliaria_corretor,
    bairro: r.bairro,
    cidade: r.cidade,
    op: r.operacao,
    aluguel: r.aluguel,
    venda: r.venda,
    cond: r.condominio,
    iptu: r.iptu,
    iptuEst: r.iptu_estimado,
    gar: r.garagem_vagas,
    garTxt: r.garagem_detalhe,
    quintal: r.quintal_tem === true,
    area: r.area_m2,
    quartos: r.quartos,
    banh: r.banheiros,
    pet: r.aceita_pet === 'aceita',
    noPet: r.aceita_pet === 'nao_permite',
    verif: r.a_verificar,
    semDados,
    obs: r.observacoes,
    link: r.link,
    custo: semDados ? null : r.aluguel + r.condominio + r.iptu,
    whatsapp: r.whatsapp,
    notas: r.notas,
    status: (r.status as StatusImovel) ?? 'nao_analisado',
    statusEm: r.status_changed_at,
    favorito: r.favorito ?? false,
  }
}

export async function fetchImoveis(): Promise<Imovel[]> {
  const res = await fetch(`${API}/imoveis?order=id`)
  const rows: DbRow[] = await res.json()
  rowsById.clear()
  rows.forEach((r) => rowsById.set(r.id, r))
  return rows.map(toImovel)
}

export interface ImoveisJson {
  total: number
  // ISO simples (sem libs). Usado só para o usuário saber quando foi gerado.
  gerado_em: string
  imoveis: Imovel[]
}

// Busca os imóveis e monta o objeto de contexto enviado ao LLM no chat.
export async function gerarJsonImoveis(): Promise<ImoveisJson> {
  const imoveis = await fetchImoveis()
  return {
    total: imoveis.length,
    gerado_em: new Date().toISOString(),
    imoveis,
  }
}

// Remove tudo que não for dígito e monta o link wa.me.
// O número informado deve incluir o DDI (ex: 55 para Brasil).
// Ex: "+55 (35) 98879-8941" -> "https://wa.me/5535988798941"
export function linkWhatsapp(numero: string): string {
  const digitos = numero.replace(/\D/g, '')
  return `https://wa.me/${digitos}`
}

// Persiste o número (apenas dígitos) no banco via PostgREST.
// Passar string vazia limpa o número (grava null).
export async function salvarWhatsapp(id: number, numero: string): Promise<string | null> {
  const digitos = numero.replace(/\D/g, '')
  const valor = digitos.length ? digitos : null
  await fetch(`${API}/imoveis?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ whatsapp: valor }),
  })
  return valor
}

// Persiste o status e o momento da mudança no banco.
export async function salvarStatus(
  id: number,
  status: StatusImovel,
): Promise<{ status: StatusImovel; statusEm: string }> {
  const statusEm = new Date().toISOString()
  await fetch(`${API}/imoveis?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, status_changed_at: statusEm }),
  })
  return { status, statusEm }
}

// Persiste as notas no banco. Texto vazio grava null.
export async function salvarNotas(id: number, notas: string): Promise<string | null> {
  const valor = notas.trim().length ? notas : null
  await fetch(`${API}/imoveis?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notas: valor }),
  })
  return valor
}

// Persiste o estado de favorito no banco via PostgREST.
export async function salvarFavorito(id: number, favorito: boolean): Promise<boolean> {
  await fetch(`${API}/imoveis?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ favorito }),
  })
  return favorito
}

// Tempo decorrido desde um ISO timestamp, em PT-BR. Ex: "há 3 dias".
export function tempoRelativo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'há instantes'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`
}

// Lista de bairros únicos presentes na lista, ordenados alfabeticamente.
export function bairrosDe(lista: Imovel[]): string[] {
  return [...new Set(lista.map((i) => i.bairro))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

// Formatação em Real (mesma do HTML original)
export const brl = (v: number): string =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Gera e baixa um arquivo .json com a lista de imóveis informada.
// Como recebe a lista já filtrada/ordenada (resultado de filtra()),
// o JSON exportado respeita os filtros selecionados na tela.
// Os imóveis são exportados no formato original do banco (DbRow:
// tipo_imovel, custo_mensal_total, etc.), preservando a ordem da lista.
export function baixarImoveisJson(lista: Imovel[]): void {
  const imoveis = lista
    .map((i) => rowsById.get(i.n))
    .filter((r): r is DbRow => r !== undefined)
  const conteudo = JSON.stringify(imoveis, null, 2)
  const blob = new Blob([conteudo], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'imoveis.json'
  a.click()
  URL.revokeObjectURL(url)
}

// Filtragem + ordenação — replica exatamente a função filtra() do HTML.
export function filtra(lista: Imovel[], state: FilterState): Imovel[] {
  const l = lista.filter((i) => {
    if (state.tipo !== 'todos' && i.tipo !== state.tipo) return false
    if (state.cidade !== 'todos' && i.cidade !== state.cidade) return false
    if (state.garagem === 'sim' && !(i.gar != null && i.gar > 0)) return false
    if (state.garagem === 'nao' && i.gar !== 0) return false
    if (state.quintal === 'sim' && !i.quintal) return false
    if (state.pet === 'sim' && !i.pet) return false
    if (state.contato === 'sim' && !i.verif) return false
    if (state.max && i.custo != null && i.custo > state.max) return false
    if (state.bairro !== 'todos' && i.bairro !== state.bairro) return false
    if (state.status === 'todos') {
      if (i.status === 'inviabilizado') return false
    } else if (i.status !== state.status) return false
    if (state.busca.trim()) {
      const q = state.busca.toLowerCase()
      const alvo = `${i.bairro} ${i.corretor} ${i.obs} ${i.cidade}`.toLowerCase()
      if (!alvo.includes(q)) return false
    }
    return true
  })

  const s = state.sort
  const big = Number.MAX_SAFE_INTEGER
  l.sort((a, b) => {
    if (a.semDados && !b.semDados) return 1
    if (b.semDados && !a.semDados) return -1
    if (s === 'custo') return (a.custo ?? big) - (b.custo ?? big)
    if (s === 'custo-desc') return (b.custo ?? -1) - (a.custo ?? -1)
    if (s === 'aluguel') return (a.aluguel ?? big) - (b.aluguel ?? big)
    if (s === 'quartos-desc') return (b.quartos ?? 0) - (a.quartos ?? 0)
    if (s === 'area-desc') return (b.area || 0) - (a.area || 0)
    return 0
  })
  return l
}

// =====================================================================
// Sessões de conversa do Chat (tabela chat_sessions via PostgREST)
// =====================================================================

// Lista as sessões para a sidebar (mais recentes primeiro), sem carregar
// as mensagens — usa select= para trazer só as colunas leves.
export async function listarSessoes(): Promise<ChatSessionResumo[]> {
  const res = await fetch(
    `${API}/chat_sessions?select=id,titulo,atualizado_em&order=atualizado_em.desc`,
  )
  if (!res.ok) throw new Error(`Falha ao listar sessões (${res.status})`)
  return res.json()
}

// Carrega uma sessão completa (com mensagens) para continuar a conversa.
export async function carregarSessao(id: number): Promise<ChatSession> {
  const res = await fetch(`${API}/chat_sessions?id=eq.${id}`)
  if (!res.ok) throw new Error(`Falha ao carregar sessão (${res.status})`)
  const rows: ChatSession[] = await res.json()
  if (!rows.length) throw new Error('Sessão não encontrada.')
  return rows[0]
}

// Cria uma nova sessão e retorna a linha criada (com id gerado).
// Prefer: return=representation faz o PostgREST devolver a linha inserida.
export async function criarSessao(
  mensagens: ChatSessionMessage[],
  modelo: string,
): Promise<ChatSession> {
  const res = await fetch(`${API}/chat_sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ mensagens, modelo, titulo: 'Nova conversa' }),
  })
  if (!res.ok) throw new Error(`Falha ao criar sessão (${res.status})`)
  const rows: ChatSession[] = await res.json()
  return rows[0]
}

// Atualiza as mensagens (e o atualizado_em) de uma sessão existente.
export async function atualizarMensagensSessao(
  id: number,
  mensagens: ChatSessionMessage[],
): Promise<void> {
  const res = await fetch(`${API}/chat_sessions?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensagens, atualizado_em: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error(`Falha ao salvar mensagens (${res.status})`)
}

// Renomeia uma sessão.
export async function renomearSessao(id: number, titulo: string): Promise<void> {
  const res = await fetch(`${API}/chat_sessions?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo }),
  })
  if (!res.ok) throw new Error(`Falha ao renomear sessão (${res.status})`)
}

// Exclui uma sessão.
export async function excluirSessao(id: number): Promise<void> {
  const res = await fetch(`${API}/chat_sessions?id=eq.${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Falha ao excluir sessão (${res.status})`)
}

// Gera e baixa um arquivo .md com a conversa (mesmo padrão de baixarImoveisJson).
export function exportarSessaoMarkdown(sessao: ChatSession): void {
  const linhas: string[] = [`# ${sessao.titulo}`, '']
  for (const m of sessao.mensagens) {
    linhas.push(m.role === 'user' ? '**Você:**' : '**Assistente:**', '', m.content, '')
  }
  const blob = new Blob([linhas.join('\n')], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const slug = sessao.titulo
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  a.download = `${slug || 'conversa'}.md`
  a.click()
  URL.revokeObjectURL(url)
}

// =====================================================================
// Rankings gerados por IA (tabela rankings via PostgREST)
// =====================================================================

export async function carregarRankingSalvo(configId: string): Promise<RankingSalvo | null> {
  const res = await fetch(`${API}/rankings?config_id=eq.${configId}&limit=1`)
  if (!res.ok) return null
  const rows: { config_id: string; conteudo: string; user_input: string | null; gerado_em: string }[] =
    await res.json()
  if (!rows.length) return null
  const r = rows[0]
  return { conteudo: r.conteudo, userInput: r.user_input, geradoEm: r.gerado_em }
}

// Upsert: substitui o registro inteiro (conteudo, user_input e gerado_em) para o configId.
export async function salvarRanking(
  configId: string,
  conteudo: string,
  userInput?: string,
): Promise<void> {
  const res = await fetch(`${API}/rankings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      config_id: configId,
      conteudo,
      user_input: userInput ?? null,
      gerado_em: new Date().toISOString(),
    }),
  })
  if (!res.ok) throw new Error(`Falha ao salvar ranking (${res.status})`)
}

export async function deletarRanking(configId: string): Promise<void> {
  const res = await fetch(`${API}/rankings?config_id=eq.${configId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Falha ao excluir ranking (${res.status})`)
}
