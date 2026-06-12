import { useMemo, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import KanbanCard from './KanbanCard'
import type { Imovel, StatusImovel } from '../types'

interface Props {
  status: StatusImovel
  label: string
  lista: Imovel[]
  onVerMais: (id: number) => void
}

// Uma coluna do kanban: zona "soltável" (useDroppable) identificada pelo status,
// com busca própria que filtra apenas os cards desta coluna.
export default function KanbanColumn({ status, label, lista, onVerMais }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const [busca, setBusca] = useState('')

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return lista
    return lista.filter((i) =>
      `${i.bairro} ${i.corretor} ${i.obs} ${i.cidade}`.toLowerCase().includes(q),
    )
  }, [lista, busca])

  return (
    <section className={`flow-col status-${status}`}>
      <header className="flow-col-head">
        <span className="flow-col-title">{label}</span>
        <span className="flow-col-count">{filtrada.length}</span>
      </header>

      <input
        className="flow-col-search"
        type="text"
        placeholder="Buscar nesta coluna..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      <div ref={setNodeRef} className={`flow-col-body ${isOver ? 'is-over' : ''}`}>
        {filtrada.length === 0 ? (
          <div className="flow-empty">{busca ? 'Nada encontrado' : 'Vazio'}</div>
        ) : (
          filtrada.map((i) => <KanbanCard key={i.n} imovel={i} onVerMais={onVerMais} />)
        )}
      </div>
    </section>
  )
}
