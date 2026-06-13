// Estrutura "crua" exatamente como vem do arquivo imoveis.json
export type AceitaPet = 'aceita' | 'nao_permite' | 'nao_informado'
export type TipoImovel = string
export type StatusImovel = 'nao_analisado' | 'aguardando' | 'inviabilizado'

export interface RawImovel {
  id: number
  tipo_imovel: TipoImovel
  imobiliaria_corretor: string
  bairro: string
  cidade: string
  operacao: string
  valores: {
    aluguel: number
    venda: number | null
    condominio: number
    iptu: number
    iptu_estimado: boolean
    custo_mensal_total: number
  }
  garagem: {
    vagas: number | null
    detalhe: string
  }
  quintal_area_externa: {
    tem: boolean | null
    observacao: string
  }
  quartos: number | null
  banheiros: number | null
  area_m2: number | null
  aceita_pet: AceitaPet
  entrar_em_contato: boolean
  a_verificar: string | null
  observacoes: string
  link: string
}

export interface RawData {
  fonte: string
  data_geracao: string
  regras: Record<string, string>
  total_imoveis: number
  resumo: Record<string, unknown>
  imoveis: RawImovel[]
}

// Estrutura normalizada usada pela interface (mesma forma do HTML original)
export interface Imovel {
  n: number
  tipo: TipoImovel
  corretor: string
  bairro: string
  cidade: string
  op: string
  aluguel: number
  venda: number | null
  cond: number
  iptu: number
  iptuEst: boolean
  gar: number | null
  garTxt: string
  quintal: boolean
  area: number | null
  quartos: number | null
  banh: number | null
  pet: boolean
  noPet: boolean
  verif: string | null
  semDados: boolean
  obs: string
  link: string
  custo: number | null
  whatsapp: string | null
  notas: string | null
  status: StatusImovel
  statusEm: string | null   // ISO da última mudança de status
  favorito: boolean
}

// Opções de ordenação (mesmos valores do <select> original)
export type SortKey = 'custo' | 'custo-desc' | 'aluguel' | 'quartos-desc' | 'area-desc'

export interface FilterState {
  tipo: string
  cidade: string
  sort: SortKey
  garagem: string
  quintal: string
  pet: string
  contato: string
  max: number | null
  busca: string
  bairro: string            // 'todos' | nome do bairro
  status: string            // 'todos' | StatusImovel
}

// --- Sessões de conversa do Chat (tabela chat_sessions) ---

// Mensagem persistida de uma sessão (sem o system prompt, só user/assistant).
// Compatível com ChatMessage de openrouter.ts (subtipo dos papéis).
export interface ChatSessionMessage {
  role: 'user' | 'assistant'
  content: string
}

// Linha completa da tabela chat_sessions (formato PostgREST).
export interface ChatSession {
  id: number
  titulo: string
  mensagens: ChatSessionMessage[]
  modelo: string | null
  criado_em: string         // ISO timestamptz
  atualizado_em: string     // ISO timestamptz
}

// Resumo leve para a sidebar (sem carregar as mensagens).
export interface ChatSessionResumo {
  id: number
  titulo: string
  atualizado_em: string
}
