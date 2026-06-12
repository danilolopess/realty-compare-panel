// Parser puro (sem JSX) para as respostas de ranking geradas pelo LLM.
// Os prompts (public/prompts/ranking-*.json) impõem um formato consistente cujo
// elemento estrutural mais confiável é o título de cada item:
//
//   ### N. Imóvel #N — bairro, cidade [(tipo)] — Nota: X.X/10
//   - *Justificativa:* ...
//   - *Ideal para:* ...      (só no ranking de pets)
//   - *Prós:* ...
//   - *Contras:* ...
//   - *Custo mensal total:* R$ ...
//
// O parse é tolerante: títulos sem #id e sem nota não viram cards (são tratados
// como seções de texto), e cada campo ausente apenas omite o respectivo enfeite.

export type TipoImovelRanking = 'Casa' | 'Apartamento'

export interface RankingItem {
  posicao: number | null
  id: number | null
  local: string
  tipo: TipoImovelRanking | null
  nota: number | null
  corpo: string
}

// Cada bloco do resultado: um item de ranking (vira card) ou uma seção de texto
// (título sem #id/nota — ex.: introduções de versões antigas do prompt).
export type RankingBloco =
  | { tipo: 'item'; item: RankingItem }
  | { tipo: 'secao'; titulo: string; corpo: string }

export interface RankingParsed {
  preambulo: string
  blocos: RankingBloco[]
  conclusao: string
}

// Casa o início de uma linha de título markdown (## a ######). Global+multiline
// para varrer o texto inteiro.
const HEADING_RE = /^[ \t]{0,3}#{1,6}[ \t]+(.+?)[ \t]*$/gm

function ehConclusao(titulo: string): boolean {
  return /conclus/i.test(titulo)
}

function extrairId(titulo: string): number | null {
  const m = titulo.match(/im[oó]vel\s*#?\s*(\d+)/i) ?? titulo.match(/#(\d+)/)
  return m ? Number(m[1]) : null
}

function extrairNota(titulo: string): number | null {
  const m = titulo.match(/nota[:\s]*(\d+(?:[.,]\d+)?)/i)
  return m ? parseFloat(m[1].replace(',', '.')) : null
}

// Extrai posição, id, local, tipo e nota de uma linha de título de item.
function parseCabecalho(titulo: string): Omit<RankingItem, 'corpo'> {
  const posMatch = titulo.match(/^\s*(\d+)[.)º°]?\s/)
  const posicao = posMatch ? Number(posMatch[1]) : null

  const id = extrairId(titulo)
  const nota = extrairNota(titulo)

  const tipoMatch = titulo.match(/\((casa|apartamento|apto)\)/i)
  let tipo: TipoImovelRanking | null = null
  if (tipoMatch) tipo = /casa/i.test(tipoMatch[1]) ? 'Casa' : 'Apartamento'

  // local = título sem nº inicial, sem "Imóvel #id", sem "(tipo)", sem "— Nota …",
  // limpo de traços/pontuação e de eventual placeholder "N." (formato antigo).
  let local = titulo
    .replace(/^\s*\d+[.)º°]?\s*/, '')
    .replace(/^N[º°.]\s*(?=[—–-]|#|$)/i, '')
    .replace(/im[oó]vel\s*#?\s*\d+/i, '')
    .replace(/#\d+/, '')
    .replace(/\((?:casa|apartamento|apto)\)/i, '')
    .replace(/[—–-]?\s*nota[:\s]*\d+(?:[.,]\d+)?\s*(?:\/\s*10)?/i, '')
    .replace(/^[\s—–:/-]+|[\s—–:/-]+$/g, '')
    .trim()
  // Normaliza espaços e vírgulas órfãs.
  local = local.replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',').replace(/,\s*$/, '')

  return { posicao, id, local, tipo, nota }
}

export function parseRanking(texto: string): RankingParsed {
  const fonte = texto ?? ''

  // Coleta todas as linhas de título com suas posições no texto.
  const titulos: { titulo: string; inicio: number; fimLinha: number }[] = []
  let m: RegExpExecArray | null
  HEADING_RE.lastIndex = 0
  while ((m = HEADING_RE.exec(fonte)) !== null) {
    titulos.push({
      titulo: m[1].trim(),
      inicio: m.index,
      fimLinha: m.index + m[0].length,
    })
  }

  const blocos: RankingBloco[] = []
  let preambulo = ''
  let conclusao = ''

  if (titulos.length === 0) {
    // Sem títulos: o chamador decide (renderiza markdown puro).
    return { preambulo: fonte.trim(), blocos, conclusao }
  }

  // Texto antes do primeiro título = preâmbulo.
  preambulo = fonte.slice(0, titulos[0].inicio).trim()

  titulos.forEach((t, i) => {
    const fim = i + 1 < titulos.length ? titulos[i + 1].inicio : fonte.length
    const corpo = fonte.slice(t.fimLinha, fim).trim()
    if (ehConclusao(t.titulo)) {
      conclusao = conclusao ? `${conclusao}\n\n${corpo}` : corpo
    } else if (extrairId(t.titulo) != null || extrairNota(t.titulo) != null) {
      // Só vira card quem tem identificação de imóvel ou nota.
      blocos.push({ tipo: 'item', item: { ...parseCabecalho(t.titulo), corpo } })
    } else {
      // Título genérico (ex.: introduções/seções) → bloco de texto.
      blocos.push({ tipo: 'secao', titulo: t.titulo, corpo })
    }
  })

  // Caso a conclusão venha como negrito (**Conclusão**) dentro do corpo do último
  // item, em vez de um título próprio, separa-a.
  if (!conclusao && blocos.length > 0) {
    const ultimo = blocos[blocos.length - 1]
    const corpoUltimo = ultimo.tipo === 'item' ? ultimo.item.corpo : ultimo.corpo
    const corte = corpoUltimo.search(/(^|\n)\s*\*{2}\s*conclus[ãa]o\s*\*{2}/i)
    if (corte >= 0) {
      const bloco = corpoUltimo.slice(corte)
      const novoCorpo = corpoUltimo.slice(0, corte).trim()
      if (ultimo.tipo === 'item') ultimo.item.corpo = novoCorpo
      else ultimo.corpo = novoCorpo
      conclusao = bloco.replace(/\*{2}\s*conclus[ãa]o\s*\*{2}\s*:?/i, '').trim()
    }
  }

  return { preambulo, blocos, conclusao }
}

export type TipoBullet =
  | 'justificativa'
  | 'ideal'
  | 'pros'
  | 'contras'
  | 'custo'
  | 'outro'

export interface RankingBullet {
  tipo: TipoBullet
  valor: string
}

function classificarRotulo(rotulo: string): TipoBullet {
  if (/justificat/i.test(rotulo)) return 'justificativa'
  if (/ideal para/i.test(rotulo)) return 'ideal'
  if (/pr[óo]s/i.test(rotulo)) return 'pros'
  if (/contras|aten[çc]/i.test(rotulo)) return 'contras'
  if (/custo/i.test(rotulo)) return 'custo'
  return 'outro'
}

// Divide o corpo de um item em bullets rotulados. Retorna null se nenhum bullet
// reconhecível for encontrado (o chamador então renderiza o corpo como markdown).
export function parseCorpo(corpo: string): RankingBullet[] | null {
  const linhas = corpo.split('\n')
  const bullets: RankingBullet[] = []

  for (const linha of linhas) {
    const bulletMatch = linha.match(/^\s*[-*+]\s+(.*)$/)
    if (!bulletMatch) continue
    const conteudo = bulletMatch[1].trim()
    // Extrai rótulo em negrito/itálico no início: *Rótulo:* valor / **Rótulo:** valor.
    const rotuloMatch = conteudo.match(/^\*{1,2}\s*([^*:]+?)\s*:?\*{1,2}\s*:?\s*(.*)$/)
    if (rotuloMatch) {
      bullets.push({
        tipo: classificarRotulo(rotuloMatch[1]),
        valor: rotuloMatch[2].trim(),
      })
    } else {
      bullets.push({ tipo: 'outro', valor: conteudo })
    }
  }

  if (bullets.length === 0) return null
  // Só vale a pena estruturar se ao menos um bullet foi reconhecido por rótulo.
  if (bullets.every((b) => b.tipo === 'outro')) return null
  return bullets
}
