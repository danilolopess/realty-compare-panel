const CHAVE = 'og-imagens'
const MAX_ENTRADAS = 200
const PARALELO = 4

type Disco = Record<string, string | null>

const memoria = new Map<string, string | null>()
let disco: Disco | null = null
let ativos = 0
let geracao = 0
const fila: Array<() => void> = []
const emVoo = new Map<string, Promise<string | null>>()
const ouvintes = new Set<() => void>()

function lerDisco(): Disco {
  if (disco) return disco
  disco = {}
  try {
    const raw = localStorage.getItem(CHAVE)
    if (!raw) return disco
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object') return disco
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' || v === null) disco[k] = v
    }
  } catch {
    disco = {}
  }
  return disco
}

function gravarDisco(url: string, image: string | null) {
  const d = lerDisco()
  if (Object.prototype.hasOwnProperty.call(d, url)) delete d[url]
  d[url] = image
  const chaves = Object.keys(d)
  if (chaves.length > MAX_ENTRADAS) {
    for (const k of chaves.slice(0, chaves.length - MAX_ENTRADAS)) delete d[k]
  }
  try {
    localStorage.setItem(CHAVE, JSON.stringify(d))
  } catch {
    // quota cheia: a memória da sessão ainda evita repetir o pedido
  }
}

function comVaga<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      ativos += 1
      fn().then(resolve, reject).finally(() => {
        ativos -= 1
        fila.shift()?.()
      })
    }
    if (ativos < PARALELO) run()
    else fila.push(run)
  })
}

/** `undefined` = ainda não consultado. */
export function lerOgCache(link: string): string | null | undefined {
  const url = link.trim()
  if (!url) return null
  if (memoria.has(url)) return memoria.get(url) ?? null
  const d = lerDisco()
  if (Object.prototype.hasOwnProperty.call(d, url)) {
    memoria.set(url, d[url])
    return d[url]
  }
  return undefined
}

export function buscarOgImage(link: string): Promise<string | null> {
  const url = link.trim()
  if (!url) return Promise.resolve(null)
  const cache = lerOgCache(url)
  if (cache !== undefined) return Promise.resolve(cache)

  const existente = emVoo.get(url)
  if (existente) return existente

  const geracaoPedido = geracao
  const pedido = comVaga(async () => {
    const res = await fetch(`/api/og?url=${encodeURIComponent(url)}`)
    if (!res.ok) throw new Error('og')
    const body = (await res.json()) as { image?: unknown }
    const image = typeof body.image === 'string' && body.image ? body.image : null
    if (geracaoPedido !== geracao) return null
    memoria.set(url, image)
    gravarDisco(url, image)
    return image
  })
    .catch(() => {
      if (geracaoPedido === geracao) memoria.set(url, null)
      return null
    })
    .finally(() => {
      if (emVoo.get(url) === pedido) emVoo.delete(url)
    })

  emVoo.set(url, pedido)
  return pedido
}

/** Apaga o cache e avisa os cartões montados para buscar de novo. */
export function recarregarOgImagens() {
  geracao += 1
  memoria.clear()
  disco = {}
  emVoo.clear()
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    // armazenamento indisponível: a memória já foi limpa
  }
  for (const ouvir of ouvintes) ouvir()
}

export function ouvirRecargaOg(ouvir: () => void): () => void {
  ouvintes.add(ouvir)
  return () => {
    ouvintes.delete(ouvir)
  }
}
