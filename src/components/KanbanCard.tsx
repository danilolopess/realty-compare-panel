import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { brl, linkWhatsapp } from '../data'
import { montaFeats } from './feats'
import type { Imovel } from '../types'

interface BodyProps {
  imovel: Imovel
  onVerMais: (id: number) => void
  // Listeners + attributes do dnd-kit, aplicados só na área de arraste.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  grabProps?: any
  overlay?: boolean
}

// Card resumido do kanban. Mostra só o essencial; os dados completos abrem
// num modal (reaproveitando o mesmo <Card> da lista de imóveis).
function FlowCardBody({ imovel: i, onVerMais, grabProps, overlay = false }: BodyProps) {
  const cls = i.tipo === 'Casa' ? 'casa' : ''
  const feats = montaFeats(i)

  return (
    <div className={`flow-card ${cls} ${overlay ? 'overlay' : ''}`}>
      <div className="flow-card-grab" {...grabProps}>
        <div className="flow-card-top">
          <h4>
            #{i.n} · {i.bairro}
          </h4>
          <span className="flow-card-custo">
            {i.semDados ? 'A confirmar' : brl(i.custo as number)}
          </span>
        </div>
        <div className="flow-card-cidade">
          {i.tipo} · {i.cidade}
        </div>
        <div className="feats">{feats}</div>
        {i.notas && <div className="flow-card-notas">{i.notas}</div>}
      </div>

      <div className="flow-card-actions">
        <a
          className="flow-icon"
          href={i.link}
          target="_blank"
          rel="noreferrer"
          title="Ver anúncio"
          draggable={false}
        >
          ↗
        </a>
        {i.whatsapp && (
          <a
            className="flow-icon zap"
            href={linkWhatsapp(i.whatsapp)}
            target="_blank"
            rel="noreferrer"
            title="WhatsApp"
            draggable={false}
          >
            💬
          </a>
        )}
        <button className="flow-vermais" onClick={() => onVerMais(i.n)}>
          Ver mais
        </button>
      </div>
    </div>
  )
}

// Versão para o DragOverlay: só o visual, sem hooks de drag.
export function KanbanCardOverlay({ imovel }: { imovel: Imovel }) {
  return <FlowCardBody imovel={imovel} onVerMais={() => {}} overlay />
}

interface Props {
  imovel: Imovel
  onVerMais: (id: number) => void
}

// Card arrastável: liga o useDraggable e repassa os listeners para a área de arraste.
export default function KanbanCard({ imovel, onVerMais }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: imovel.n,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    // Enquanto arrasta, o original some (o DragOverlay assume o visual).
    opacity: isDragging ? 0 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <FlowCardBody imovel={imovel} onVerMais={onVerMais} grabProps={{ ...listeners, ...attributes }} />
    </div>
  )
}
