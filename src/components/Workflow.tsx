import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import KanbanColumn from './KanbanColumn'
import { KanbanCardOverlay } from './KanbanCard'
import Modal from './Modal'
import Card from './Card'
import { STATUS_LABEL } from './feats'
import { fetchImoveis, salvarFavorito, salvarNotas, salvarStatus, salvarWhatsapp } from '../data'
import type { Imovel, StatusImovel } from '../types'

// Ordem das colunas do kanban (uma por status).
const COLUNAS: StatusImovel[] = ['nao_analisado', 'aguardando', 'inviabilizado']

export default function Workflow() {
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [verMaisId, setVerMaisId] = useState<number | null>(null)

  useEffect(() => {
    fetchImoveis().then((data) => {
      setImoveis(data)
      setLoading(false)
    })
  }, [])

  // distance: 5 evita disparar o drag em cliques nos botões/ícones do card.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Mesmos handlers de persistência + atualização otimista usados no Painel.
  const onStatus = async (id: number, status: StatusImovel) => {
    const { status: novo, statusEm } = await salvarStatus(id, status)
    setImoveis((prev) => prev.map((i) => (i.n === id ? { ...i, status: novo, statusEm } : i)))
  }
  const onWhatsapp = async (id: number, numero: string) => {
    const valor = await salvarWhatsapp(id, numero)
    setImoveis((prev) => prev.map((i) => (i.n === id ? { ...i, whatsapp: valor } : i)))
  }
  const onNotas = async (id: number, notas: string) => {
    const valor = await salvarNotas(id, notas)
    setImoveis((prev) => prev.map((i) => (i.n === id ? { ...i, notas: valor } : i)))
  }
  const onFavorito = async (id: number, favorito: boolean) => {
    const valor = await salvarFavorito(id, favorito)
    setImoveis((prev) => prev.map((i) => (i.n === id ? { ...i, favorito: valor } : i)))
  }

  const porStatus = useMemo(() => {
    const grupos: Record<StatusImovel, Imovel[]> = {
      nao_analisado: [],
      aguardando: [],
      inviabilizado: [],
    }
    imoveis.forEach((i) => grupos[i.status].push(i))
    return grupos
  }, [imoveis])

  const ativo = activeId != null ? imoveis.find((i) => i.n === activeId) ?? null : null
  const selecionado = verMaisId != null ? imoveis.find((i) => i.n === verMaisId) ?? null : null

  const onDragStart = (e: DragStartEvent) => setActiveId(Number(e.active.id))

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const id = Number(active.id)
    const destino = over.id as StatusImovel
    const atual = imoveis.find((i) => i.n === id)
    if (atual && atual.status !== destino) onStatus(id, destino)
  }

  if (loading) return <p style={{ padding: '2rem' }}>Carregando imóveis...</p>

  return (
    <>
      <p className="sub flow-sub">
        Arraste os cartões entre as colunas para mudar o status — a mudança é salva automaticamente.
      </p>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flow-board">
          {COLUNAS.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              label={STATUS_LABEL[status]}
              lista={porStatus[status]}
              onVerMais={setVerMaisId}
            />
          ))}
        </div>

        <DragOverlay>{ativo ? <KanbanCardOverlay imovel={ativo} /> : null}</DragOverlay>
      </DndContext>

      {selecionado && (
        <Modal onFechar={() => setVerMaisId(null)}>
          <Card
            imovel={selecionado}
            onWhatsapp={onWhatsapp}
            onStatus={onStatus}
            onNotas={onNotas}
            onFavorito={onFavorito}
          />
        </Modal>
      )}
    </>
  )
}
