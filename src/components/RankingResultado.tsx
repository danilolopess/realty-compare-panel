import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { parseRanking, parseCorpo } from '../rankingParse'
import type { RankingBullet, RankingItem, TipoBullet } from '../rankingParse'

interface Props {
  texto: string
  onAbrirImovel: (id: number) => void
  existeImovel: (id: number) => boolean
}

// Rebaixa h1/h2 para h3 — o LLM pode usar "# texto" mas não queremos headings gigantes.
const mdComponents = {
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 {...props}>{children}</h3>,
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 {...props}>{children}</h3>,
}

// Markdown inline (sem <p> em volta) para o valor de cada bullet.
const mdInline = {
  ...mdComponents,
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <span {...props}>{children}</span>,
}

function Md({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {children}
    </ReactMarkdown>
  )
}

// Ícone exibido à esquerda de cada linha estruturada do corpo.
const ICONE: Record<TipoBullet, string> = {
  justificativa: '📝',
  ideal: '🎯',
  pros: '✓',
  contras: '✕',
  custo: '💰',
  outro: '•',
}

function faixaNota(nota: number): string {
  if (nota >= 8) return 'nota-alta'
  if (nota >= 6) return 'nota-media'
  return 'nota-baixa'
}

function classePodio(posicao: number | null): string {
  if (posicao === 1) return 'pos-1'
  if (posicao === 2) return 'pos-2'
  if (posicao === 3) return 'pos-3'
  return ''
}

function Linha({ bullet }: { bullet: RankingBullet }) {
  return (
    <div className={`ranking-linha is-${bullet.tipo}`}>
      <span className="ranking-linha-icone" aria-hidden="true">
        {ICONE[bullet.tipo]}
      </span>
      <span className="ranking-linha-valor">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdInline}>
          {bullet.valor}
        </ReactMarkdown>
      </span>
    </div>
  )
}

function ItemCard({
  item,
  onAbrirImovel,
  existeImovel,
}: {
  item: RankingItem
  onAbrirImovel: (id: number) => void
  existeImovel: (id: number) => boolean
}) {
  const bullets = parseCorpo(item.corpo)
  const clicavel = item.id != null && existeImovel(item.id)

  const cabecalho = (
    <>
      <span className={`ranking-pos ${classePodio(item.posicao)}`}>
        {item.posicao ?? '•'}
      </span>
      <span className="ranking-item-id">
        {item.id != null && <span className="ranking-item-n">#{item.id}</span>}
        <span className="ranking-item-local">{item.local || 'Imóvel'}</span>
        {item.tipo && (
          <span className={`badge ${item.tipo === 'Casa' ? 'b-casa' : 'b-apto'}`}>{item.tipo}</span>
        )}
      </span>
      {item.nota != null && (
        <span className={`ranking-nota ${faixaNota(item.nota)}`}>
          {item.nota.toFixed(1).replace('.', ',')}
          <small>/10</small>
        </span>
      )}
    </>
  )

  const tipoCard = item.tipo === 'Casa' ? 'casa' : item.tipo === 'Apartamento' ? 'apto' : ''

  return (
    <div className={`ranking-item ${tipoCard}`}>
      {clicavel ? (
        <button
          type="button"
          className="ranking-item-head is-clicavel"
          onClick={() => onAbrirImovel(item.id as number)}
          title={`Ver detalhes do imóvel #${item.id}`}
        >
          {cabecalho}
        </button>
      ) : (
        <div className="ranking-item-head">{cabecalho}</div>
      )}

      <div className="ranking-item-corpo">
        {bullets ? (
          bullets.map((b, i) => <Linha key={i} bullet={b} />)
        ) : (
          <div className="ranking-resultado-conteudo ranking-corpo-md">
            <Md>{item.corpo}</Md>
          </div>
        )}
      </div>
    </div>
  )
}

export default function RankingResultado({ texto, onAbrirImovel, existeImovel }: Props) {
  const { preambulo, blocos, conclusao } = parseRanking(texto)
  const temItens = blocos.some((b) => b.tipo === 'item')

  // Tier 0: nenhum item de ranking reconhecido → renderiza tudo como markdown puro.
  if (!temItens) {
    return (
      <div className="ranking-resultado-conteudo">
        <Md>{texto}</Md>
      </div>
    )
  }

  return (
    <div className="ranking-itens">
      {preambulo && (
        <div className="ranking-preambulo">
          <Md>{preambulo}</Md>
        </div>
      )}

      {blocos.map((b, i) =>
        b.tipo === 'item' ? (
          <ItemCard key={i} item={b.item} onAbrirImovel={onAbrirImovel} existeImovel={existeImovel} />
        ) : (
          <div key={i} className="ranking-secao">
            <span className="ranking-secao-titulo">{b.titulo}</span>
            {b.corpo && <Md>{b.corpo}</Md>}
          </div>
        ),
      )}

      {conclusao && (
        <div className="ranking-conclusao">
          <span className="ranking-conclusao-titulo">Conclusão</span>
          <Md>{conclusao}</Md>
        </div>
      )}
    </div>
  )
}
