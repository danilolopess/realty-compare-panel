import { useEffect, useMemo, useState } from 'react'
import Controls from './Controls'
import Stats from './Stats'
import Card from './Card'
import Legend from './Legend'
import {
  baixarImoveisJson,
  bairrosDe,
  cidadesDe,
  dominiosDe,
  fetchImoveis,
  filtra,
  imobiliariasDe,
  IPTU_ESTIMADO_PADRAO,
  salvarFavorito,
  salvarNotas,
  salvarStatus,
  salvarWhatsapp,
  tiposDe,
} from '../data'
import { recarregarOgImagens } from '../ogImage'
import type { FilterState, Imovel, SortKey, StatusImovel } from '../types'

const CHAVE_FILTROS = 'painel-filtros'

const SORTS: readonly SortKey[] = ['custo', 'custo-desc', 'aluguel', 'quartos-desc', 'area-desc']

const estadoInicial: FilterState = {
  tipo: 'todos',
  cidade: 'todos',
  sort: 'custo',
  garagem: 'todos',
  quintal: 'todos',
  pet: 'todos',
  contato: 'todos',
  max: null,
  busca: '',
  bairro: 'todos',
  imobiliaria: 'todos',
  dominio: 'todos',
  status: 'todos',
}

function texto(valor: unknown, fallback: string): string {
  return typeof valor === 'string' ? valor : fallback
}

function lerFiltros(): FilterState {
  try {
    const raw = localStorage.getItem(CHAVE_FILTROS)
    if (!raw) return estadoInicial
    const o = JSON.parse(raw) as Partial<Record<keyof FilterState, unknown>>
    const sort = SORTS.includes(o.sort as SortKey) ? (o.sort as SortKey) : estadoInicial.sort
    const max = typeof o.max === 'number' && Number.isFinite(o.max) ? o.max : null
    return {
      tipo: texto(o.tipo, estadoInicial.tipo),
      cidade: texto(o.cidade, estadoInicial.cidade),
      sort,
      garagem: texto(o.garagem, estadoInicial.garagem),
      quintal: texto(o.quintal, estadoInicial.quintal),
      pet: texto(o.pet, estadoInicial.pet),
      contato: texto(o.contato, estadoInicial.contato),
      max,
      busca: texto(o.busca, estadoInicial.busca),
      bairro: texto(o.bairro, estadoInicial.bairro),
      imobiliaria: texto(o.imobiliaria, estadoInicial.imobiliaria),
      dominio: texto(o.dominio, estadoInicial.dominio),
      status: texto(o.status, estadoInicial.status),
    }
  } catch {
    return estadoInicial
  }
}

export default function Painel({
  somenteFavoritos = false,
  onAdicionar,
}: {
  somenteFavoritos?: boolean
  onAdicionar?: () => void
}) {
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<FilterState>(lerFiltros)

  useEffect(() => {
    fetchImoveis().then((data) => {
      setImoveis(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_FILTROS, JSON.stringify(state))
    } catch {
      // sem localStorage disponível
    }
  }, [state])

  const onChange = (patch: Partial<FilterState>) =>
    setState((prev) => ({ ...prev, ...patch }))

  const limparFiltros = () =>
    setState((prev) => ({ ...estadoInicial, sort: prev.sort }))

  const podeLimpar =
    state.tipo !== estadoInicial.tipo ||
    state.cidade !== estadoInicial.cidade ||
    state.garagem !== estadoInicial.garagem ||
    state.quintal !== estadoInicial.quintal ||
    state.pet !== estadoInicial.pet ||
    state.contato !== estadoInicial.contato ||
    state.max !== estadoInicial.max ||
    state.busca !== estadoInicial.busca ||
    state.bairro !== estadoInicial.bairro ||
    state.imobiliaria !== estadoInicial.imobiliaria ||
    state.dominio !== estadoInicial.dominio ||
    state.status !== estadoInicial.status

  const onWhatsapp = async (id: number, numero: string) => {
    const valor = await salvarWhatsapp(id, numero)
    setImoveis((prev) =>
      prev.map((i) => (i.n === id ? { ...i, whatsapp: valor } : i)),
    )
  }

  const onStatus = async (id: number, status: StatusImovel) => {
    const { status: novo, statusEm } = await salvarStatus(id, status)
    setImoveis((prev) =>
      prev.map((i) => (i.n === id ? { ...i, status: novo, statusEm } : i)),
    )
  }

  const onNotas = async (id: number, notas: string) => {
    const valor = await salvarNotas(id, notas)
    setImoveis((prev) =>
      prev.map((i) => (i.n === id ? { ...i, notas: valor } : i)),
    )
  }

  const onFavorito = async (id: number, favorito: boolean) => {
    const valor = await salvarFavorito(id, favorito)
    setImoveis((prev) =>
      prev.map((i) => (i.n === id ? { ...i, favorito: valor } : i)),
    )
  }

  const base = useMemo(
    () => (somenteFavoritos ? imoveis.filter((i) => i.favorito) : imoveis),
    [imoveis, somenteFavoritos],
  )
  const tipos = useMemo(() => tiposDe(base), [base])
  const cidades = useMemo(() => cidadesDe(base), [base])
  const paraBairros = useMemo(() => filtra(base, { ...state, bairro: 'todos' }), [base, state])
  const paraImobiliarias = useMemo(
    () => filtra(base, { ...state, imobiliaria: 'todos' }),
    [base, state],
  )
  const paraDominios = useMemo(() => filtra(base, { ...state, dominio: 'todos' }), [base, state])
  const bairros = useMemo(() => bairrosDe(paraBairros), [paraBairros])
  const imobiliarias = useMemo(() => imobiliariasDe(paraImobiliarias), [paraImobiliarias])
  const dominios = useMemo(() => dominiosDe(paraDominios), [paraDominios])
  const filtrosVisiveis = useMemo(() => ({
    tipo:    tipos.length > 1,
    cidade:  cidades.length > 1,
    bairro:  bairros.length > 1,
    imobiliaria: imobiliarias.length > 1,
    dominio: dominios.length > 1,
    garagem: base.some((i) => i.gar != null && i.gar > 0) &&
             base.some((i) => !(i.gar != null && i.gar > 0)),
    quintal: base.some((i) => i.quintal) && base.some((i) => !i.quintal),
    pet:     base.some((i) => i.pet)     && base.some((i) => !i.pet),
    contato: base.some((i) => i.verif)   && base.some((i) => !i.verif),
  }), [base, tipos, cidades, bairros, imobiliarias, dominios])

  useEffect(() => {
    if (loading) return
    const patch: Partial<FilterState> = {}
    if (!filtrosVisiveis.tipo    && state.tipo    !== 'todos') patch.tipo    = 'todos'
    if (!filtrosVisiveis.cidade  && state.cidade  !== 'todos') patch.cidade  = 'todos'
    if (!filtrosVisiveis.bairro  && state.bairro  !== 'todos') patch.bairro  = 'todos'
    if (state.bairro !== 'todos' && !bairros.includes(state.bairro)) patch.bairro = 'todos'
    if (!filtrosVisiveis.imobiliaria && state.imobiliaria !== 'todos') patch.imobiliaria = 'todos'
    if (state.imobiliaria !== 'todos' && !imobiliarias.includes(state.imobiliaria)) {
      patch.imobiliaria = 'todos'
    }
    if (!filtrosVisiveis.dominio && state.dominio !== 'todos') patch.dominio = 'todos'
    if (state.dominio !== 'todos' && !dominios.includes(state.dominio)) patch.dominio = 'todos'
    if (!filtrosVisiveis.garagem && state.garagem !== 'todos') patch.garagem = 'todos'
    if (!filtrosVisiveis.quintal && state.quintal !== 'todos') patch.quintal = 'todos'
    if (!filtrosVisiveis.pet     && state.pet     !== 'todos') patch.pet     = 'todos'
    if (!filtrosVisiveis.contato && state.contato !== 'todos') patch.contato = 'todos'
    if (Object.keys(patch).length > 0) setState((prev) => ({ ...prev, ...patch }))
  }, [filtrosVisiveis, loading, state, bairros, imobiliarias, dominios])

  const lista = useMemo(() => filtra(base, state), [base, state])

  if (loading) return <p style={{ padding: '2rem' }}>Carregando imóveis...</p>

  return (
    <>
      <p className="sub">
        {somenteFavoritos ? (
          <>
            ❤️ {base.length} {base.length === 1 ? 'imóvel favoritado' : 'imóveis favoritados'} ·
            filtre e ordene como no Painel.
          </>
        ) : (
          <>
            {imoveis.length} imóveis. Regra aplicada: IPTU não informado = R$ {IPTU_ESTIMADO_PADRAO} (estimado).
          </>
        )}
      </p>

      <div className="layout">
        <aside className="sidebar">
          <Controls
            state={state}
            onChange={onChange}
            onLimpar={limparFiltros}
            podeLimpar={podeLimpar}
            bairros={bairros}
            imobiliarias={imobiliarias}
            dominios={dominios}
            tipos={tipos}
            cidades={cidades}
            filtrosVisiveis={filtrosVisiveis}
          />
        </aside>

        <main className="content">
          <div className="toolbar">
            {!somenteFavoritos && onAdicionar && (
              <button className="btn btn-adicionar" onClick={onAdicionar}>
                + Adicionar imóvel
              </button>
            )}
            <button className="btn-fotos" type="button" onClick={() => recarregarOgImagens()}>
              Atualizar fotos
            </button>
            <button
              className="btn-json"
              onClick={() => baixarImoveisJson(lista)}
              disabled={lista.length === 0}
            >
              ⬇️ Gerar JSON ({lista.length})
            </button>
          </div>

          <Stats lista={lista} />

          <div className="grid">
            {lista.length === 0 ? (
              <div className="empty">
                {somenteFavoritos && base.length === 0
                  ? 'Nenhum imóvel favoritado ainda. Toque no ❤️ de um cartão no Painel.'
                  : 'Nenhum imóvel com esses filtros.'}
              </div>
            ) : (
              lista.map((i) => (
                <Card
                  key={i.n}
                  imovel={i}
                  onWhatsapp={onWhatsapp}
                  onStatus={onStatus}
                  onNotas={onNotas}
                  onFavorito={onFavorito}
                />
              ))
            )}
          </div>

          <Legend />
        </main>
      </div>
    </>
  )
}
