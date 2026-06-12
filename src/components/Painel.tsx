import { useEffect, useMemo, useState } from 'react'
import Controls from './Controls'
import Stats from './Stats'
import Card from './Card'
import Legend from './Legend'
import {
  baixarImoveisJson,
  bairrosDe,
  fetchImoveis,
  filtra,
  salvarFavorito,
  salvarNotas,
  salvarStatus,
  salvarWhatsapp,
} from '../data'
import type { FilterState, Imovel, StatusImovel } from '../types'

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
  status: 'todos',
}

export default function Painel({ somenteFavoritos = false }: { somenteFavoritos?: boolean }) {
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<FilterState>(estadoInicial)

  useEffect(() => {
    fetchImoveis().then((data) => {
      setImoveis(data)
      setLoading(false)
    })
  }, [])

  const onChange = (patch: Partial<FilterState>) =>
    setState((prev) => ({ ...prev, ...patch }))

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
  const bairros = useMemo(() => bairrosDe(base), [base])
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
            {imoveis.length} imóveis (Poços de Caldas + São João da Boa Vista/SP) · filtre, ordene e
            compare. Regra aplicada: IPTU não informado = R$ 80 (estimado).
          </>
        )}
      </p>

      <div className="layout">
        <aside className="sidebar">
          <Controls state={state} onChange={onChange} bairros={bairros} />
        </aside>

        <main className="content">
          <div className="toolbar">
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
