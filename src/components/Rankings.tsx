import { useCallback, useEffect, useState } from 'react'
import RankingCard from './RankingCard'
import Modal from './Modal'
import Card from './Card'
import { carregarPromptConfig } from '../rankings'
import type { PromptConfig } from '../rankings'
import {
  gerarJsonImoveis,
  salvarFavorito,
  salvarNotas,
  salvarStatus,
  salvarWhatsapp,
} from '../data'
import type { Imovel, StatusImovel } from '../types'

const CONFIGS = [
  {
    id: 'custo-beneficio',
    mensagemLoading: 'Analisando custo-benefício de cada imóvel...',
  },
  {
    id: 'pets',
    mensagemLoading: 'Avaliando o bem-estar de animais em cada imóvel...',
  },
  {
    id: 'melhores-imoveis',
    mensagemLoading: 'Avaliando qualidade absoluta de cada imóvel...',
  },
  {
    id: 'personalizado',
    mensagemLoading: 'Construindo seu ranking personalizado com IA...',
  },
]

export default function Rankings() {
  const [configs, setConfigs] = useState<Record<string, PromptConfig> | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // Imóveis carregados uma vez para abrir o detalhe ao clicar num card de ranking.
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [modalImovelId, setModalImovelId] = useState<number | null>(null)
  const fecharModal = useCallback(() => setModalImovelId(null), [])

  useEffect(() => {
    Promise.all(CONFIGS.map((c) => carregarPromptConfig(c.id)))
      .then((results) => {
        const map: Record<string, PromptConfig> = {}
        results.forEach((cfg) => {
          map[cfg.id] = cfg
        })
        setConfigs(map)
      })
      .catch((e) => {
        setErro(e instanceof Error ? e.message : 'Erro ao carregar configurações de ranking.')
      })

    // Falha ao carregar imóveis não bloqueia: os cards apenas ficam não-clicáveis.
    gerarJsonImoveis()
      .then((json) => setImoveis(json.imoveis))
      .catch(() => {
        /* sem imóveis: cards de ranking não abrem o modal */
      })
  }, [])

  // Handlers de persistência para o Card no modal — espelham o Chat.tsx.
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

  const existeImovel = useCallback((id: number) => imoveis.some((i) => i.n === id), [imoveis])

  if (erro) {
    return (
      <div className="empty">
        <p>{erro}</p>
      </div>
    )
  }

  if (!configs) {
    return <div className="empty">Carregando rankings...</div>
  }

  return (
    <div className="rankings-page">
      <h1>Rankings com IA</h1>
      <p className="sub">
        Rankings gerados sob demanda com inteligência artificial. Clique em "Gerar Ranking" para
        criar cada lista com base nos imóveis atuais.
      </p>
      <div className="rankings-grid">
        {CONFIGS.map((c) => (
          <RankingCard
            key={c.id}
            config={configs[c.id]}
            mensagemLoading={c.mensagemLoading}
            onAbrirImovel={setModalImovelId}
            existeImovel={existeImovel}
          />
        ))}
      </div>

      {modalImovelId !== null && (() => {
        const im = imoveis.find((x) => x.n === modalImovelId)
        if (!im) return null
        return (
          <Modal onClose={fecharModal}>
            <Card imovel={im} onWhatsapp={onWhatsapp} onStatus={onStatus} onNotas={onNotas} onFavorito={onFavorito} />
          </Modal>
        )
      })()}
    </div>
  )
}
