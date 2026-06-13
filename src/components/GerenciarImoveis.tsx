import { useEffect, useRef, useState } from 'react'
import AdicionarImovelForm from './AdicionarImovelForm'
import { brl, excluirImoveis, fetchImoveis, getImovelInput, purgarTodosRankings } from '../data'
import type { Imovel } from '../types'
import EditarImovelModal from './EditarImovelModal'

export type ImovelView = 'lista' | 'adicionar'

type Modo = 'idle' | 'excluir'

interface Props {
  view: ImovelView
  onViewChange: (v: ImovelView) => void
}

export default function GerenciarImoveis({ view, onViewChange: setView }: Props) {
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [loading, setLoading] = useState(true)
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())
  const [modo, setModo] = useState<Modo>('idle')
  const [operando, setOperando] = useState(false)
  const [erroOperacao, setErroOperacao] = useState<string | null>(null)
  const [popoverExcluir, setPopoverExcluir] = useState<{
    id: number
    bairro: string
    top: number
    right: number
  } | null>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [busca, setBusca] = useState('')
  const headerCheckRef = useRef<HTMLInputElement>(null)

  const imoveisFiltrados = busca.trim()
    ? imoveis.filter((i) => {
        const q = busca.toLowerCase()
        return (
          String(i.n).includes(q) ||
          (i.tipo?.toLowerCase().includes(q) ?? false) ||
          (i.bairro?.toLowerCase().includes(q) ?? false) ||
          (i.cidade?.toLowerCase().includes(q) ?? false) ||
          (i.op?.toLowerCase().includes(q) ?? false)
        )
      })
    : imoveis

  const todosSelecionados = imoveisFiltrados.length > 0 && imoveisFiltrados.every((i) => selecionados.has(i.n))
  const algunsSelecionados = !todosSelecionados && imoveisFiltrados.some((i) => selecionados.has(i.n))

  useEffect(() => {
    fetchImoveis().then((data) => {
      setImoveis(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (headerCheckRef.current) {
      headerCheckRef.current.indeterminate = algunsSelecionados
    }
  }, [algunsSelecionados])

  function toggleSelecionado(id: number) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTodos() {
    if (todosSelecionados) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(imoveisFiltrados.map((i) => i.n)))
    }
  }

  function limparSelecao() {
    setSelecionados(new Set())
    setModo('idle')
    setErroOperacao(null)
  }

  async function posOperacao() {
    await purgarTodosRankings()
    sessionStorage.removeItem('imoveis_chat_json')
    const updated = await fetchImoveis()
    setImoveis(updated)
    setSelecionados(new Set())
    setModo('idle')
  }

  async function confirmarExclusao() {
    setOperando(true)
    setErroOperacao(null)
    try {
      await excluirImoveis([...selecionados])
      await posOperacao()
    } catch (e) {
      setErroOperacao(e instanceof Error ? e.message : 'Erro ao excluir imóveis.')
      setModo('idle')
    } finally {
      setOperando(false)
    }
  }

  async function excluirUm(id: number) {
    setPopoverExcluir(null)
    setErroOperacao(null)
    try {
      await excluirImoveis([id])
      await purgarTodosRankings()
      sessionStorage.removeItem('imoveis_chat_json')
      const updated = await fetchImoveis()
      setImoveis(updated)
    } catch (e) {
      setErroOperacao(e instanceof Error ? e.message : 'Erro ao excluir imóvel.')
    }
  }

  const imovelParaEditar = editandoId !== null ? getImovelInput(editandoId) : null

  function sortBy(col: string) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const lista: Imovel[] = sortCol
    ? [...imoveisFiltrados].sort((a, b) => {
        let va: string | number | null | undefined
        let vb: string | number | null | undefined
        if (sortCol === 'n')        { va = a.n;      vb = b.n }
        else if (sortCol === 'tipo')     { va = a.tipo;   vb = b.tipo }
        else if (sortCol === 'bairro')   { va = a.bairro; vb = b.bairro }
        else if (sortCol === 'cidade')   { va = a.cidade; vb = b.cidade }
        else if (sortCol === 'custo')    { va = a.custo;  vb = b.custo }
        else if (sortCol === 'operacao') { va = a.op;     vb = b.op }
        if (va == null) return sortDir === 'asc' ? 1 : -1
        if (vb == null) return sortDir === 'asc' ? -1 : 1
        const cmp =
          typeof va === 'number' && typeof vb === 'number'
            ? va - vb
            : String(va).localeCompare(String(vb), 'pt-BR')
        return sortDir === 'asc' ? cmp : -cmp
      })
    : imoveisFiltrados

  function ThSort({ col, label }: { col: string; label: string }) {
    const ativo = sortCol === col
    return (
      <th className={`th-sort${ativo ? ' th-sort-ativo' : ''}`} onClick={() => sortBy(col)}>
        {label}
        <span className="th-sort-icon">{ativo ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ⇅'}</span>
      </th>
    )
  }

  const onCriado = () => {
    fetchImoveis().then(setImoveis)
    setView('lista')
  }

  if (view === 'adicionar') {
    return (
      <div className="imoveis-page">
        <div className="imoveis-breadcrumb">
          <button className="imoveis-breadcrumb-btn" onClick={() => setView('lista')}>
            ← Imóveis
          </button>
          <span className="imoveis-breadcrumb-sep">/</span>
          <span className="imoveis-breadcrumb-atual">Novo imóvel</span>
        </div>
        <AdicionarImovelForm onCancelar={() => setView('lista')} onCriado={onCriado} />
      </div>
    )
  }

  return (
    <>
    <div className="imoveis-page">
      <div className="imoveis-header">
        <div>
          <div className="imoveis-titulo">Imóveis cadastrados</div>
          {!loading && (
            <p className="sub" style={{ margin: 0 }}>
              {busca.trim() && imoveisFiltrados.length !== imoveis.length
                ? `${imoveisFiltrados.length} de ${imoveis.length} registros`
                : `${imoveis.length} ${imoveis.length === 1 ? 'registro' : 'registros'}`}
            </p>
          )}
        </div>
        <input
          className="imoveis-busca"
          type="text"
          placeholder="Buscar por tipo, bairro, cidade..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <button className="btn btn-adicionar" onClick={() => setView('adicionar')}>
          + Adicionar imóvel
        </button>
      </div>

      {erroOperacao && <div className="imoveis-barra-erro">{erroOperacao}</div>}

      {selecionados.size > 0 && (
        <div className="imoveis-barra-massa">
          {modo === 'excluir' ? (
            <>
              <span className="imoveis-barra-massa-count">
                Excluir {selecionados.size}{' '}
                {selecionados.size === 1 ? 'imóvel' : 'imóveis'}? Esta ação é irreversível.
              </span>
              <button
                className="btn imoveis-barra-btn-sec"
                onClick={() => setModo('idle')}
                disabled={operando}
              >
                Cancelar
              </button>
              <button
                className="btn imoveis-barra-btn-perigo"
                onClick={confirmarExclusao}
                disabled={operando}
              >
                {operando ? 'Excluindo...' : 'Confirmar'}
              </button>
            </>
          ) : (
            <>
              <span className="imoveis-barra-massa-count">
                {selecionados.size} {selecionados.size === 1 ? 'selecionado' : 'selecionados'}
              </span>
              <button className="btn imoveis-barra-btn-sec" onClick={limparSelecao}>
                Limpar seleção
              </button>
              <button className="btn imoveis-barra-btn-perigo" onClick={() => setModo('excluir')}>
                Excluir
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <p style={{ padding: '2rem' }}>Carregando imóveis...</p>
      ) : imoveis.length === 0 ? (
        <p className="empty">Nenhum imóvel cadastrado ainda.</p>
      ) : (
        <table className="imoveis-tabela">
          <thead>
            <tr>
              <th className="th-check">
                <input
                  type="checkbox"
                  ref={headerCheckRef}
                  checked={todosSelecionados}
                  onChange={toggleTodos}
                />
              </th>
              <ThSort col="n" label="#" />
              <ThSort col="tipo" label="Tipo" />
              <ThSort col="bairro" label="Bairro" />
              <ThSort col="cidade" label="Cidade" />
              <ThSort col="custo" label="Custo/mês" />
              <ThSort col="operacao" label="Operação" />
              <th className="th-acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((i) => (
              <tr
                key={i.n}
                className={selecionados.has(i.n) ? 'selecionada' : undefined}
                onClick={() => toggleSelecionado(i.n)}
              >
                <td className="td-check" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selecionados.has(i.n)}
                    onChange={() => toggleSelecionado(i.n)}
                  />
                </td>
                <td className="td-id">{i.n}</td>
                <td>{i.tipo}</td>
                <td>{i.bairro}</td>
                <td>{i.cidade}</td>
                <td className="td-custo">
                  {i.custo != null ? brl(i.custo) : <span style={{ color: '#aaa' }}>—</span>}
                </td>
                <td>{i.op}</td>
                <td className="td-acoes" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="imoveis-acao-btn editar"
                    title="Editar"
                    onClick={() => setEditandoId(i.n)}
                  >
                    ✏️
                  </button>
                  <button
                    className="imoveis-acao-btn excluir"
                    title="Excluir"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setPopoverExcluir({
                        id: i.n,
                        bairro: i.bairro,
                        top: rect.bottom + 6,
                        right: window.innerWidth - rect.right,
                      })
                    }}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>

    {popoverExcluir && (
      <>
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 199 }}
          onClick={() => setPopoverExcluir(null)}
        />
        <div
          className="excluir-popover"
          style={{ top: popoverExcluir.top, right: popoverExcluir.right }}
        >
          <p className="excluir-popover-msg">
            Excluir imóvel #{popoverExcluir.id} ({popoverExcluir.bairro})?
          </p>
          <p className="excluir-popover-aviso">Esta ação é irreversível.</p>
          <div className="excluir-popover-acoes">
            <button className="btn excluir-popover-btn-sec" onClick={() => setPopoverExcluir(null)}>
              Cancelar
            </button>
            <button
              className="btn imoveis-barra-btn-perigo"
              onClick={() => excluirUm(popoverExcluir.id)}
            >
              Confirmar
            </button>
          </div>
        </div>
      </>
    )}

    {editandoId !== null && imovelParaEditar && (
      <EditarImovelModal
        imovelId={editandoId}
        dadosIniciais={imovelParaEditar}
        onFechar={() => setEditandoId(null)}
        onSalvo={async () => {
          setEditandoId(null)
          const updated = await fetchImoveis()
          setImoveis(updated)
        }}
      />
    )}
    </>
  )
}
