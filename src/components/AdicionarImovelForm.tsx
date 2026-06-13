import { useState } from 'react'
import { criarImovel, IPTU_ESTIMADO_PADRAO, purgarTodosRankings } from '../data'
import type { ImovelInput } from '../data'
import { chamarLLMDireto, MODELO_PADRAO } from '../openrouter'
import type { ChatMessage } from '../openrouter'
import type { AceitaPet, TipoImovel } from '../types'
import ImovelFormFields from './ImovelFormFields'

interface Props {
  onCancelar: () => void
  onCriado: () => void
}

type Fase = 'descricao' | 'formulario' | 'salvando'

const SYSTEM_PROMPT_EXTRACAO = `You are a real estate data extractor. The user may provide one or multiple property descriptions in a single input.

Return ONLY a valid JSON array — one object per property — with no additional text, no explanations, no markdown code blocks. If there is only one property, still return an array with a single element: [{...}].

IDENTIFYING MULTIPLE PROPERTIES:
The input may contain multiple properties separated by any pattern, including but not limited to:
- Horizontal dividers: ---, ===, ..., ___, ~~~
- Multiple consecutive blank lines between blocks
- Numbered or labeled entries (e.g. "1.", "2.", "#1", "Imóvel 1:", "Casa 1 —", etc.)
- Any clear visual or textual boundary between independent descriptions

Treat each independent block as one property and extract it separately. Do not merge data from different blocks into a single object.

INFERENCE RULES:
- garagem_vagas: if there is no mention of a garage at all → use 0 and add "Verify garage" to a_verificar. If a garage is mentioned but the number of spots is not specified → use 1. If it is explicitly stated there is no garage → use 0.
- aceita_pet: use "nao_informado" when not mentioned. Do NOT add anything about pets to a_verificar if there is no mention.
- a_verificar: include only information the user explicitly marked as uncertain, pending, or to be confirmed. Do not include your own assumptions.
- observacoes: include ONLY information that does not fit into the structured fields (unusual features, special conditions, non-obvious relevant details). Do NOT repeat: cost values, address/neighborhood/city, bedroom/bathroom counts, garage spots, pet policy, area, operation type (rental/sale). If there is nothing outside the fields, use "".

Each object in the array must have exactly these fields:
{
  "tipo_imovel": "Apartamento" or "Casa",
  "imobiliaria_corretor": string (real estate agency or broker name, "" if not provided),
  "bairro": string (required),
  "cidade": string (required, city name only — strip any state/province suffix regardless of separator (/, ,, -, or spelled out); e.g. "Poços de Caldas/MG" → "Poços de Caldas", "São João da Boa Vista - São Paulo" → "São João da Boa Vista"),
  "operacao": "Locação" or "Venda",
  "aluguel": number or null,
  "venda": number or null,
  "condominio": number (0 if not provided),
  "iptu": number (0 if not provided),
  "iptu_estimado": boolean (true if IPTU was estimated/approximate),
  "custo_mensal_total": number (aluguel + condominio + iptu),
  "garagem_vagas": number (see rule above),
  "garagem_detalhe": string ("" if not provided),
  "quintal_tem": boolean or null,
  "quintal_observacao": string ("" if not provided),
  "quartos": number or null,
  "banheiros": number or null,
  "area_m2": number or null,
  "aceita_pet": "aceita" or "nao_permite" or "nao_informado",
  "entrar_em_contato": false,
  "a_verificar": string or null (see rule above),
  "observacoes": string (see rule above),
  "link": string or null (listing URL),
  "whatsapp": string or null (digits only, with country code),
  "status": "nao_analisado",
  "status_changed_at": null,
  "notas": null,
  "favorito": false
}`

function extrairJsonArray(resposta: string): Record<string, unknown>[] {
  // Prefer array response
  const arrInicio = resposta.indexOf('[')
  const arrFim = resposta.lastIndexOf(']')
  if (arrInicio !== -1 && arrFim !== -1 && arrFim > arrInicio) {
    try {
      const parsed = JSON.parse(resposta.slice(arrInicio, arrFim + 1))
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as Record<string, unknown>[]
    } catch { /* fall through to single object */ }
  }
  // Fallback: single object
  const inicio = resposta.indexOf('{')
  const fim = resposta.lastIndexOf('}')
  if (inicio === -1 || fim === -1 || fim <= inicio)
    throw new Error('Nenhum objeto JSON encontrado na resposta.')
  return [JSON.parse(resposta.slice(inicio, fim + 1)) as Record<string, unknown>]
}

function validarCamposObrigatorios(raw: Record<string, unknown>): void {
  const tiposValidos = ['Casa', 'Apartamento', 'casa', 'apartamento']
  if (!tiposValidos.includes(raw.tipo_imovel as string))
    throw new Error(`tipo_imovel inválido: "${String(raw.tipo_imovel)}". Use "Apartamento" ou "Casa".`)

  const petsValidos = ['aceita', 'nao_permite', 'nao_informado', 'sim', 'nao', '']
  if (!petsValidos.includes(raw.aceita_pet as string))
    throw new Error(`aceita_pet inválido: "${String(raw.aceita_pet)}".`)

  if (raw.aluguel !== null && typeof raw.aluguel !== 'number')
    throw new Error(`aluguel deve ser número ou null, recebido: ${typeof raw.aluguel}`)

  if (!raw.bairro || typeof raw.bairro !== 'string')
    throw new Error('bairro é obrigatório.')

  if (!raw.cidade || typeof raw.cidade !== 'string')
    throw new Error('cidade é obrigatória.')
}

function normalizarExtraido(raw: Record<string, unknown>): ImovelInput {
  const tipoRaw = String(raw.tipo_imovel ?? '').toLowerCase()
  const tipo: TipoImovel = tipoRaw === 'casa' ? 'Casa' : 'Apartamento'

  const petRaw = String(raw.aceita_pet ?? '').toLowerCase()
  let pet: AceitaPet = 'nao_informado'
  if (petRaw === 'aceita' || petRaw === 'sim') pet = 'aceita'
  else if (petRaw === 'nao_permite' || petRaw === 'nao') pet = 'nao_permite'

  const aluguel = typeof raw.aluguel === 'number' ? raw.aluguel : 0
  const condominio = typeof raw.condominio === 'number' ? raw.condominio : 0
  let iptu = typeof raw.iptu === 'number' ? raw.iptu : 0
  let iptuEst = Boolean(raw.iptu_estimado)
  if (iptu === 0 && !raw.iptu_estimado) {
    iptu = IPTU_ESTIMADO_PADRAO
    iptuEst = true
  }

  const link = raw.link != null && String(raw.link).trim() ? String(raw.link).trim() : ''

  return {
    tipo_imovel: tipo,
    imobiliaria_corretor: typeof raw.imobiliaria_corretor === 'string' ? raw.imobiliaria_corretor : '',
    bairro: String(raw.bairro ?? ''),
    cidade: String(raw.cidade ?? ''),
    operacao: typeof raw.operacao === 'string' && raw.operacao ? raw.operacao : 'Locação',
    aluguel,
    venda: typeof raw.venda === 'number' ? raw.venda : null,
    condominio,
    iptu,
    iptu_estimado: iptuEst,
    custo_mensal_total: aluguel + condominio + iptu,
    garagem_vagas: typeof raw.garagem_vagas === 'number' ? raw.garagem_vagas : null,
    garagem_detalhe: typeof raw.garagem_detalhe === 'string' ? raw.garagem_detalhe : '',
    quintal_tem: typeof raw.quintal_tem === 'boolean' ? raw.quintal_tem : null,
    quintal_observacao: typeof raw.quintal_observacao === 'string' ? raw.quintal_observacao : '',
    quartos: typeof raw.quartos === 'number' ? raw.quartos : null,
    banheiros: typeof raw.banheiros === 'number' ? raw.banheiros : null,
    area_m2: typeof raw.area_m2 === 'number' ? raw.area_m2 : null,
    aceita_pet: pet,
    entrar_em_contato: Boolean(raw.entrar_em_contato),
    a_verificar: typeof raw.a_verificar === 'string' && raw.a_verificar ? raw.a_verificar : null,
    observacoes: typeof raw.observacoes === 'string' ? raw.observacoes : '',
    link,
    whatsapp: typeof raw.whatsapp === 'string' && raw.whatsapp ? raw.whatsapp : null,
    status: 'nao_analisado',
    status_changed_at: null,
    notas: null,
    favorito: false,
  }
}

const MAX_TENTATIVAS = 5

export default function AdicionarImovelForm({ onCancelar, onCriado }: Props) {
  const [fase, setFase] = useState<Fase>('descricao')
  const [descricao, setDescricao] = useState('')
  const [interpretando, setInterpretando] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const [erroInterpretacao, setErroInterpretacao] = useState<string | null>(null)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const [forms, setForms] = useState<ImovelInput[]>([])
  const [formIdx, setFormIdx] = useState(0)
  const [maxIdxVisitado, setMaxIdxVisitado] = useState(0)

  const form = forms[formIdx] ?? null

  function setField<K extends keyof ImovelInput>(key: K, value: ImovelInput[K]) {
    setForms((prev) => {
      const updated = [...prev]
      updated[formIdx] = { ...updated[formIdx], [key]: value }
      return updated
    })
  }

  async function interpretar() {
    if (!descricao.trim()) return
    setInterpretando(true)
    setErroInterpretacao(null)
    setTentativa(0)
    let ultimoErro = ''

    for (let t = 1; t <= MAX_TENTATIVAS; t++) {
      setTentativa(t)
      try {
        const messages: ChatMessage[] = [
          { role: 'system', content: SYSTEM_PROMPT_EXTRACAO },
          { role: 'user', content: descricao },
        ]
        const resposta = await chamarLLMDireto(messages, MODELO_PADRAO)
        const raws = extrairJsonArray(resposta)
        if (raws.length === 0) throw new Error('Nenhum imóvel encontrado na resposta.')
        raws.forEach((raw, i) => {
          try {
            validarCamposObrigatorios(raw)
          } catch (e) {
            throw new Error(`Imóvel ${i + 1}: ${e instanceof Error ? e.message : String(e)}`)
          }
        })
        const normalizados = raws.map(normalizarExtraido)
        setForms(normalizados)
        setFormIdx(0)
        setMaxIdxVisitado(0)
        setFase('formulario')
        setInterpretando(false)
        return
      } catch (e) {
        ultimoErro = e instanceof Error ? e.message : 'Erro desconhecido'
      }
    }

    setErroInterpretacao(
      `Não foi possível interpretar a descrição após ${MAX_TENTATIVAS} tentativas. Último erro: ${ultimoErro}`,
    )
    setInterpretando(false)
  }

  async function adicionarTodos() {
    if (forms.length === 0) return
    setFase('salvando')
    setErroSalvar(null)
    try {
      for (const f of forms) {
        await criarImovel({ ...f, custo_mensal_total: f.aluguel + f.condominio + f.iptu })
      }
      await purgarTodosRankings()
      sessionStorage.removeItem('imoveis_chat_json')
      onCriado()
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : 'Erro ao salvar imóveis.')
      setFase('formulario')
    }
  }

  const total = forms.length
  const isBatch = total > 1

  return (
    <div className="add-imovel-modal">
      <div className="add-imovel-titulo">
        {fase === 'descricao'
          ? '+ Adicionar imóveis'
          : isBatch
            ? `Revisar imóvel ${formIdx + 1} de ${total}`
            : 'Revisar dados do imóvel'}
      </div>

      {fase === 'descricao' && (
        <>
          {interpretando ? (
            <div className="add-imovel-skeleton">
              <div className="add-imovel-sk-status">
                <span className="add-imovel-sk-icon">🤖</span>
                <span className="add-imovel-sk-texto">
                  {tentativa >= 2
                    ? `Tentativa ${tentativa}/${MAX_TENTATIVAS} — refinando resultado...`
                    : 'Identificando e construindo fichas dos imóveis...'}
                </span>
                <span className="loader-dot" />
                <span className="loader-dot" />
                <span className="loader-dot" />
              </div>

              <div className="add-imovel-sk-secoes">
                <div className="add-imovel-secao">
                  <div className="add-imovel-secao-titulo">Identificação</div>
                  <div className="add-imovel-row">
                    <div className="ranking-sk-line add-imovel-sk-campo" />
                    <div className="ranking-sk-line add-imovel-sk-campo add-imovel-sk-d2" />
                  </div>
                  <div className="add-imovel-row">
                    <div className="ranking-sk-line add-imovel-sk-campo add-imovel-sk-d3" />
                    <div className="ranking-sk-line add-imovel-sk-campo add-imovel-sk-d4" />
                  </div>
                  <div className="ranking-sk-line add-imovel-sk-campo add-imovel-sk-d5" style={{ width: '100%' }} />
                </div>

                <div className="add-imovel-secao">
                  <div className="add-imovel-secao-titulo">Valores</div>
                  <div className="add-imovel-row">
                    <div className="ranking-sk-line add-imovel-sk-campo add-imovel-sk-d2" />
                    <div className="ranking-sk-line add-imovel-sk-campo add-imovel-sk-d3" />
                    <div className="ranking-sk-line add-imovel-sk-campo add-imovel-sk-d4" />
                  </div>
                </div>

                <div className="add-imovel-secao">
                  <div className="add-imovel-secao-titulo">Características</div>
                  <div className="add-imovel-row">
                    <div className="ranking-sk-line add-imovel-sk-campo add-imovel-sk-d3" />
                    <div className="ranking-sk-line add-imovel-sk-campo add-imovel-sk-d4" />
                    <div className="ranking-sk-line add-imovel-sk-campo add-imovel-sk-d5" />
                  </div>
                  <div className="add-imovel-row">
                    <div className="ranking-sk-line add-imovel-sk-campo add-imovel-sk-d2" />
                    <div className="ranking-sk-line add-imovel-sk-campo add-imovel-sk-d6" />
                  </div>
                </div>

                <div className="add-imovel-secao">
                  <div className="add-imovel-secao-titulo">Contato</div>
                  <div className="ranking-sk-line add-imovel-sk-campo add-imovel-sk-d4" style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="add-imovel-field add-imovel-field--full">
                <div className="add-imovel-label-row">
                  <label className="add-imovel-label">Descrição dos imóveis</label>
                  <span className="chat-modelo">{MODELO_PADRAO}</span>
                </div>
                <textarea
                  className="add-imovel-textarea add-imovel-textarea--lote"
                  placeholder={`Descreva um ou mais imóveis em linguagem natural. Para múltiplos, separe-os com uma linha em branco, ---, === ou qualquer divisor claro.\n\nExemplo:\nApartamento no centro, 2 quartos, 1 vaga, R$ 900/mês\n\n---\n\nCasa no bairro X, 3 quartos, sem garagem, R$ 1.200/mês`}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={12}
                />
              </div>

              {erroInterpretacao && (
                <div className="add-imovel-erro">{erroInterpretacao}</div>
              )}
            </>
          )}

          <div className="add-imovel-actions">
            <button className="btn" style={{ background: '#888' }} onClick={onCancelar} disabled={interpretando}>
              Cancelar
            </button>
            <button className="btn" onClick={interpretar} disabled={interpretando || !descricao.trim()}>
              {interpretando ? 'Interpretando...' : 'Interpretar'}
            </button>
          </div>
        </>
      )}

      {(fase === 'formulario' || fase === 'salvando') && form && (
        <>
          {isBatch && (
            <div className="add-imovel-nav">
              <button
                className="add-imovel-nav-btn"
                onClick={() => setFormIdx((i) => i - 1)}
                disabled={formIdx === 0 || fase === 'salvando'}
              >
                ← Anterior
              </button>
              <span className="add-imovel-nav-contador">
                {formIdx + 1} / {total}
              </span>
              <button
                className="add-imovel-nav-btn"
                onClick={() => {
                  const next = formIdx + 1
                  setMaxIdxVisitado((m) => Math.max(m, next))
                  setFormIdx(next)
                }}
                disabled={formIdx === total - 1 || fase === 'salvando'}
              >
                Próximo →
              </button>
            </div>
          )}

          <ImovelFormFields form={form} setField={setField} disabled={fase === 'salvando'} />

          {erroSalvar && <div className="add-imovel-erro">{erroSalvar}</div>}

          <div className="add-imovel-actions">
            <button
              className="btn"
              style={{ background: '#888' }}
              onClick={() => { setFase('descricao'); setForms([]); setFormIdx(0); setMaxIdxVisitado(0) }}
              disabled={fase === 'salvando'}
            >
              ← Voltar
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              {isBatch && maxIdxVisitado < total - 1 && fase !== 'salvando' && (
                <span style={{ fontSize: '.75rem', color: '#aaa' }}>
                  Revise o imóvel {total} de {total} para liberar
                </span>
              )}
              <button
                className="btn"
                onClick={adicionarTodos}
                disabled={fase === 'salvando' || (isBatch && maxIdxVisitado < total - 1)}
              >
                {fase === 'salvando'
                  ? 'Salvando...'
                  : isBatch
                    ? `Adicionar todos (${total})`
                    : 'Adicionar'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
