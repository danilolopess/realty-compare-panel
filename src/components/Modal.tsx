import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  titulo?: string
  onFechar: () => void
  children: React.ReactNode
}

export default function Modal({ titulo, onFechar, children }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onFechar])

  const root = document.getElementById('modal-root')
  if (!root) return null

  return createPortal(
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onFechar} aria-label="Fechar">
          ✕
        </button>
        {titulo && <div className="modal-titulo">{titulo}</div>}
        {children}
      </div>
    </div>,
    root,
  )
}
