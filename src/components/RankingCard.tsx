import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { gerarRanking } from '../rankings'
import type { PromptConfig } from '../rankings'

type Estado = 'idle' | 'loading' | 'done' | 'error'

interface Props {
  config: PromptConfig
  mensagemLoading: string
}

const mdComponents = {
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 {...props}>{children}</h3>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 {...props}>{children}</h3>
  ),
}

export default function RankingCard({ config, mensagemLoading }: Props) {
  const [estado, setEstado] = useState<Estado>('idle')
  const [resultado, setResultado] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [userInput, setUserInput] = useState('')

  const isPersonalizado = config.id === 'personalizado'
  const podeGerar = !isPersonalizado || userInput.trim().length > 0

  async function gerar() {
    if (!podeGerar) return
    setEstado('loading')
    setErro(null)
    try {
      const texto = await gerarRanking(config, isPersonalizado ? userInput : undefined)
      setResultado(texto)
      setEstado('done')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao gerar o ranking.')
      setEstado('error')
    }
  }

  return (
    <div className="ranking-card">
      <div className="ranking-card-header">
        <h3 className="ranking-card-titulo">{config.titulo}</h3>
        <p className="ranking-card-desc">{config.descricao}</p>
      </div>

      {estado !== 'loading' && estado !== 'done' && (
        <div className="ranking-card-body">
          {isPersonalizado && (
            <textarea
              className="ranking-textarea"
              placeholder="Descreva o ranking que você quer... Ex: imóveis mais espaçosos para família com cachorro, ou melhores para home office"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              rows={3}
            />
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

      {estado === 'done' && (
        <div className="ranking-resultado">
          <div className="ranking-resultado-conteudo chat-bolha">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {resultado}
            </ReactMarkdown>
          </div>
          <button
            className="btn ranking-btn-refazer"
            onClick={() => {
              setEstado('idle')
              setResultado('')
            }}
          >
            Gerar novamente
          </button>
        </div>
      )}
    </div>
  )
}
