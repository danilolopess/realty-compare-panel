import { useState } from 'react'
import Modal from './Modal'
import ImovelFormFields from './ImovelFormFields'
import { atualizarImovel, purgarTodosRankings } from '../data'
import type { ImovelInput } from '../data'

interface Props {
  imovelId: number
  dadosIniciais: ImovelInput
  onFechar: () => void
  onSalvo: () => void
}

export default function EditarImovelModal({ imovelId, dadosIniciais, onFechar, onSalvo }: Props) {
  const [form, setFormState] = useState<ImovelInput>(dadosIniciais)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function setField<K extends keyof ImovelInput>(key: K, value: ImovelInput[K]) {
    setFormState((prev) => ({ ...prev, [key]: value }))
  }

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      await atualizarImovel(imovelId, form)
      await purgarTodosRankings()
      sessionStorage.removeItem('imoveis_chat_json')
      onSalvo()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={`Editar imóvel #${imovelId}`} onFechar={onFechar}>
      <div className="add-imovel-modal">
        <ImovelFormFields form={form} setField={setField} disabled={salvando} />
        {erro && <div className="add-imovel-erro">{erro}</div>}
        <div className="add-imovel-actions">
          <button
            className="btn"
            style={{ background: '#888' }}
            onClick={onFechar}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button className="btn" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
