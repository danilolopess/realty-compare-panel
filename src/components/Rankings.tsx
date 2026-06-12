import { useEffect, useState } from 'react'
import RankingCard from './RankingCard'
import { carregarPromptConfig } from '../rankings'
import type { PromptConfig } from '../rankings'

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
  }, [])

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
          />
        ))}
      </div>
    </div>
  )
}
