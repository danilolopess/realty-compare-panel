import type { ReactNode } from 'react'
import type { Imovel, StatusImovel } from '../types'

// Rótulos de status compartilhados entre o Painel (Card) e o Workflow (Kanban).
export const STATUS_LABEL: Record<StatusImovel, string> = {
  nao_analisado: 'Não analisado',
  aguardando: 'Aguardando resposta',
  inviabilizado: 'Inviabilizado',
}

// Monta os "chips" de características de um imóvel (quartos, banheiros, área,
// garagem, quintal, pet, IPTU estimado). Compartilhado entre Card e KanbanCard
// para não duplicar a lógica.
export function montaFeats(i: Imovel): ReactNode[] {
  const feats: ReactNode[] = []
  feats.push(<span key="q" className="feat">🛏️ {i.quartos} q</span>)
  if (i.banh != null) feats.push(<span key="b" className="feat">🚿 {i.banh} banh</span>)
  if (i.area) feats.push(<span key="a" className="feat">📐 {i.area} m²</span>)
  if (i.gar != null)
    feats.push(
      i.gar > 0 ? (
        <span key="g" className="feat ok">🚗 {i.garTxt}</span>
      ) : (
        <span key="g" className="feat no">🚗 sem garagem</span>
      ),
    )
  if (i.quintal) feats.push(<span key="qt" className="feat ok">🌳 quintal / área externa</span>)
  if (i.pet) feats.push(<span key="p" className="feat ok">🐾 aceita pet</span>)
  if (i.noPet) feats.push(<span key="np" className="feat no">🚫 NÃO aceita pet</span>)
  if (i.iptuEst) feats.push(<span key="iptu" className="feat est">IPTU est. R$80</span>)
  return feats
}
