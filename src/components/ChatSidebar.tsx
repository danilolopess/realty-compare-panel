import { useState } from 'react'
import type { ChatSessionResumo } from '../types'

interface Props {
  sessoes: ChatSessionResumo[]
  sessaoAtivaId: number | null
  onNova: () => void
  onSelecionar: (id: number) => void
  onRenomear: (id: number, titulo: string) => void
  onExportar: (id: number) => void
  onExcluir: (id: number) => void
}

export default function ChatSidebar({
  sessoes,
  sessaoAtivaId,
  onNova,
  onSelecionar,
  onRenomear,
  onExportar,
  onExcluir,
}: Props) {
  // Estado de renomeação inline: qual id está em edição e o texto atual.
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [textoEdicao, setTextoEdicao] = useState('')

  function iniciarEdicao(s: ChatSessionResumo) {
    setEditandoId(s.id)
    setTextoEdicao(s.titulo)
  }

  function confirmarEdicao() {
    if (editandoId == null) return
    const titulo = textoEdicao.trim()
    if (titulo) onRenomear(editandoId, titulo)
    setEditandoId(null)
  }

  return (
    <aside className="chat-sidebar">
      <button className="btn btn-nova" onClick={onNova}>
        ＋ Nova conversa
      </button>

      {sessoes.length === 0 && <div className="chat-sidebar-vazio">Nenhuma conversa salva.</div>}

      {sessoes.map((s) => (
        <div
          key={s.id}
          className={`chat-sessao ${s.id === sessaoAtivaId ? 'ativa' : ''}`}
          onClick={() => editandoId !== s.id && onSelecionar(s.id)}
        >
          {editandoId === s.id ? (
            <input
              className="chat-sessao-rename"
              value={textoEdicao}
              autoFocus
              onChange={(e) => setTextoEdicao(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={confirmarEdicao}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  confirmarEdicao()
                } else if (e.key === 'Escape') {
                  setEditandoId(null)
                }
              }}
            />
          ) : (
            <>
              <span className="chat-sessao-titulo" title={s.titulo}>
                {s.titulo}
              </span>
              <span className="chat-sessao-acoes">
                <button
                  title="Renomear"
                  onClick={(e) => {
                    e.stopPropagation()
                    iniciarEdicao(s)
                  }}
                >
                  ✎
                </button>
                <button
                  title="Exportar em Markdown"
                  onClick={(e) => {
                    e.stopPropagation()
                    onExportar(s.id)
                  }}
                >
                  ⬇
                </button>
                <button
                  title="Excluir"
                  onClick={(e) => {
                    e.stopPropagation()
                    onExcluir(s.id)
                  }}
                >
                  🗑
                </button>
              </span>
            </>
          )}
        </div>
      ))}
    </aside>
  )
}
