import { useEffect, useRef, useState } from 'react'
import { carregarRankingSalvo, deletarRanking, salvarRanking } from '../data'
import type { RankingSalvo } from '../data'
import { gerarRanking } from '../rankings'
import type { PromptConfig } from '../rankings'
import RankingResultado from './RankingResultado'

type Estado = 'carregando' | 'idle' | 'loading' | 'done' | 'error'

const SUGESTOES: string[] = [
  'Melhores para home office',
  'Mais espaçosos para família com cachorro',
  'Melhor custo-benefício para casal',
  'Imóveis com quintal amplo',
  'Menor custo mensal total',
  'Mais próximos ao centro',
]

interface Props {
  config: PromptConfig
  mensagemLoading: string
  onAbrirImovel: (id: number) => void
  existeImovel: (id: number) => boolean
}

export default function RankingCard({ config, mensagemLoading, onAbrirImovel, existeImovel }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [estado, setEstado] = useState<Estado>('carregando')
  const [resultado, setResultado] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [userInput, setUserInput] = useState('')
  const [geradoEm, setGeradoEm] = useState<string | null>(null)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const [colapsado, setColapsado] = useState(false)

  useEffect(() => {
    carregarRankingSalvo(config.id)
      .then((salvo: RankingSalvo | null) => {
        if (salvo) {
          setResultado(salvo.conteudo)
          if (salvo.userInput) setUserInput(salvo.userInput)
          setGeradoEm(salvo.geradoEm)
          setEstado('done')
        } else {
          setEstado('idle')
        }
      })
      .catch(() => setEstado('idle'))
  }, [config.id])

  const isPersonalizado = config.id === 'personalizado'
  const podeGerar = !isPersonalizado || userInput.trim().length > 0

  async function excluir() {
    try {
      await deletarRanking(config.id)
      setResultado('')
      setGeradoEm(null)
      setErroSalvar(null)
      setColapsado(false)
      setEstado('idle')
    } catch {
      setErroSalvar('Não foi possível excluir o ranking.')
    }
  }

  async function gerar() {
    if (!podeGerar) return
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setColapsado(false)
    setEstado('loading')
    setErro(null)
    setErroSalvar(null)
    try {
      const texto = await gerarRanking(config, isPersonalizado ? userInput : undefined)
      const agora = new Date().toISOString()
      setResultado(texto)
      setGeradoEm(agora)
      setEstado('done')
      salvarRanking(config.id, texto, isPersonalizado ? userInput : undefined).catch(() =>
        setErroSalvar('Não foi possível salvar o ranking.'),
      )
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao gerar o ranking.')
      setEstado('error')
    }
  }

  function formatarData(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="ranking-card" ref={cardRef}>
      <div className="ranking-card-header">
        <div className="ranking-card-header-row">
          <h3 className="ranking-card-titulo">{config.titulo}</h3>
          {estado === 'done' && (
            <button
              className="ranking-btn-toggle"
              onClick={() => setColapsado((c) => !c)}
              title={colapsado ? 'Mostrar ranking' : 'Ocultar ranking'}
            >
              {colapsado ? '▶' : '▼'}
            </button>
          )}
        </div>
        <p className="ranking-card-desc">{config.descricao}</p>
      </div>

      {estado === 'carregando' && (
        <div className="ranking-loading">
          <p className="ranking-loading-msg">Carregando...</p>
        </div>
      )}

      {estado !== 'loading' && estado !== 'done' && estado !== 'carregando' && (
        <div className="ranking-card-body">
          {isPersonalizado && (
            <>
              <textarea
                className="ranking-textarea"
                placeholder="Descreva o ranking que você quer... Ex: imóveis mais espaçosos para família com cachorro, ou melhores para home office"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                rows={3}
              />
              <div className={`ranking-sugestoes${userInput.trim() ? ' ranking-sugestoes--preenchido' : ''}`}>
                <span className="ranking-sugestoes-label">Ideias:</span>
                {SUGESTOES.map((s) => (
                  <button key={s} className="ranking-sugestao-chip" onClick={() => setUserInput(s)} type="button">
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}

          {estado === 'error' && (
            <div className="ranking-erro">{erro}</div>
          )}

          <button
            className="btn ranking-btn-gerar"
            onClick={gerar}
            disabled={!podeGerar}
          >
            Gerar Ranking
          </button>
        </div>
      )}

      {estado === 'loading' && (
        <div className="ranking-loading">
          <div className="ranking-skeleton">
            <div className="ranking-sk-line ranking-sk-w80" />
            <div className="ranking-sk-line ranking-sk-w60" />
            <div className="ranking-sk-line ranking-sk-w90" />
            <div className="ranking-sk-line ranking-sk-w50" />
            <div className="ranking-sk-line ranking-sk-w75" />
            <div className="ranking-sk-line ranking-sk-w65" />
          </div>
          <p className="ranking-loading-msg">✦ {mensagemLoading}</p>
        </div>
      )}

      {estado === 'done' && !colapsado && (
        <div className="ranking-resultado">
          <RankingResultado
            texto={resultado}
            onAbrirImovel={onAbrirImovel}
            existeImovel={existeImovel}
          />
          {geradoEm && (
            <p className="ranking-gerado-em">Gerado em {formatarData(geradoEm)}</p>
          )}
          {erroSalvar && (
            <div className="ranking-erro">{erroSalvar}</div>
          )}
          {isPersonalizado && (
            <>
              <textarea
                className="ranking-textarea"
                placeholder="Descreva o ranking que você quer..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                rows={3}
              />
              <div className={`ranking-sugestoes${userInput.trim() ? ' ranking-sugestoes--preenchido' : ''}`}>
                <span className="ranking-sugestoes-label">Ideias:</span>
                {SUGESTOES.map((s) => (
                  <button key={s} className="ranking-sugestao-chip" onClick={() => setUserInput(s)} type="button">
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="ranking-acoes">
            <button className="btn ranking-btn-refazer" onClick={gerar}>
              Gerar novamente
            </button>
            <button className="ranking-btn-excluir" onClick={excluir}>
              Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
