import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ChatSidebar from './ChatSidebar'
import Modal from './Modal'
import Card from './Card'
import {
  atualizarMensagensSessao,
  brl,
  carregarSessao,
  criarSessao,
  excluirSessao,
  exportarSessaoMarkdown,
  gerarJsonImoveis,
  listarSessoes,
  renomearSessao,
  salvarFavorito,
  salvarNotas,
  salvarStatus,
  salvarWhatsapp,
} from '../data'
import type { ImoveisJson } from '../data'
import { MODELO_PADRAO, enviarChatStream, gerarTitulo } from '../openrouter'
import type { ChatSessionMessage, ChatSessionResumo } from '../types'

// Rebaixa h1/h2 para h3 — o LLM pode usar "# texto" mas não queremos headings gigantes na bolha.
// h3/h4 ficam como estão; o CSS os estiliza adequadamente.
const mdComponents = {
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 {...props}>{children}</h3>,
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 {...props}>{children}</h3>,
}

// Extrai IDs de imóveis mencionados no texto via regex.
// Reconhece "Imóvel 42", "imovel 42" e "#42"; retorna na ordem de aparição, sem duplicatas.
function extrairIdsImoveis(texto: string): number[] {
  const seen = new Set<number>()
  const result: number[] = []
  const regex = /im[oó]vel\s+(\d+)|#(\d+)/gi
  let m: RegExpExecArray | null
  while ((m = regex.exec(texto)) !== null) {
    const id = Number(m[1] ?? m[2])
    if (!seen.has(id)) { seen.add(id); result.push(id) }
  }
  return result
}

// Chave do sessionStorage onde o JSON de contexto fica guardado.
const STORAGE_KEY = 'imoveis_chat_json'

function lerJsonSalvo(): ImoveisJson | null {
  const cru = sessionStorage.getItem(STORAGE_KEY)
  if (!cru) return null
  try {
    return JSON.parse(cru) as ImoveisJson
  } catch {
    return null
  }
}

function formatarData(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR')
}

// Move a sessão de id para o topo da lista (mais recente primeiro).
function moverTopo(lista: ChatSessionResumo[], id: number): ChatSessionResumo[] {
  const idx = lista.findIndex((s) => s.id === id)
  if (idx <= 0) return lista
  const atualizada = { ...lista[idx], atualizado_em: new Date().toISOString() }
  return [atualizada, ...lista.slice(0, idx), ...lista.slice(idx + 1)]
}

export default function Chat() {
  const [contexto, setContexto] = useState<ImoveisJson | null>(() => lerJsonSalvo())
  const [gerando, setGerando] = useState(false)
  const [erroJson, setErroJson] = useState<string | null>(null)

  const [modalImovelId, setModalImovelId] = useState<number | null>(null)
  const fecharModal = useCallback(() => setModalImovelId(null), [])

  // Handlers de persistência para o Card aberto no modal — espelham o Workflow.tsx.
  // Atualizam também o contexto local para que re-aberturas do modal mostrem dados frescos.
  const onStatus = async (id: number, status: import('../types').StatusImovel) => {
    const { status: novo, statusEm } = await salvarStatus(id, status)
    setContexto((prev) =>
      prev ? { ...prev, imoveis: prev.imoveis.map((i) => (i.n === id ? { ...i, status: novo, statusEm } : i)) } : prev,
    )
  }
  const onWhatsapp = async (id: number, numero: string) => {
    const valor = await salvarWhatsapp(id, numero)
    setContexto((prev) =>
      prev ? { ...prev, imoveis: prev.imoveis.map((i) => (i.n === id ? { ...i, whatsapp: valor } : i)) } : prev,
    )
  }
  const onNotas = async (id: number, notas: string) => {
    const valor = await salvarNotas(id, notas)
    setContexto((prev) =>
      prev ? { ...prev, imoveis: prev.imoveis.map((i) => (i.n === id ? { ...i, notas: valor } : i)) } : prev,
    )
  }
  const onFavorito = async (id: number, favorito: boolean) => {
    const valor = await salvarFavorito(id, favorito)
    setContexto((prev) =>
      prev ? { ...prev, imoveis: prev.imoveis.map((i) => (i.n === id ? { ...i, favorito: valor } : i)) } : prev,
    )
  }

  const [mensagens, setMensagens] = useState<ChatSessionMessage[]>([])
  const [entrada, setEntrada] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erroChat, setErroChat] = useState<string | null>(null)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const [respostaStreaming, setRespostaStreaming] = useState<string>('')

  // Sessões persistidas no banco.
  const [sessoes, setSessoes] = useState<ChatSessionResumo[]>([])
  const [sessaoAtivaId, setSessaoAtivaId] = useState<number | null>(null)
  // Ids cujo título já foi definido (gerado ou manual): não regerar.
  const tituloGeradoRef = useRef<Set<number>>(new Set())

  const fimRef = useRef<HTMLDivElement>(null)

  // (Re)gera o JSON dos imóveis e persiste no sessionStorage.
  async function atualizarJson() {
    setGerando(true)
    setErroJson(null)
    try {
      const json = await gerarJsonImoveis()
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(json))
      setContexto(json)
    } catch (e) {
      setErroJson(e instanceof Error ? e.message : 'Falha ao gerar o JSON dos imóveis.')
    } finally {
      setGerando(false)
    }
  }

  // Ao acessar a página: gera o JSON (se preciso) e carrega a lista de sessões.
  useEffect(() => {
    if (!lerJsonSalvo()) atualizarJson()
    listarSessoes()
      .then(setSessoes)
      .catch(() => {
        /* sidebar fica vazia se o banco não responder */
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rola para a última mensagem sempre que a conversa muda.
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, enviando, respostaStreaming])

  // Gera o título via gemini-3.1-flash-lite e atualiza a sessão. Em background:
  // falha aqui não deve afetar o chat (mantém "Nova conversa").
  async function gerarTituloEAtualizar(id: number, historico: ChatSessionMessage[]) {
    try {
      const titulo = await gerarTitulo(historico)
      await renomearSessao(id, titulo)
      setSessoes((prev) => prev.map((s) => (s.id === id ? { ...s, titulo } : s)))
    } catch {
      /* silencioso */
    }
  }

  // Salva a conversa no banco após cada resposta do assistant.
  async function persistir(historico: ChatSessionMessage[]) {
    try {
      let id = sessaoAtivaId
      if (id == null) {
        const s = await criarSessao(historico, MODELO_PADRAO)
        id = s.id
        setSessaoAtivaId(id)
        setSessoes((prev) => [
          { id: s.id, titulo: s.titulo, atualizado_em: s.atualizado_em },
          ...prev,
        ])
      } else {
        await atualizarMensagensSessao(id, historico)
        setSessoes((prev) => moverTopo(prev, id as number))
      }
      // Gera título na 1ª vez que a sessão é salva (em background).
      if (!tituloGeradoRef.current.has(id)) {
        tituloGeradoRef.current.add(id)
        void gerarTituloEAtualizar(id, historico)
      }
    } catch (e) {
      setErroSalvar(
        e instanceof Error ? `Não foi possível salvar: ${e.message}` : 'Falha ao salvar a conversa.',
      )
    }
  }

  async function enviar() {
    const texto = entrada.trim()
    if (!texto || enviando) return
    if (!contexto) {
      setErroChat('Gere o JSON dos imóveis antes de perguntar.')
      return
    }

    const historico: ChatSessionMessage[] = [...mensagens, { role: 'user', content: texto }]
    setMensagens(historico)
    setEntrada('')
    setEnviando(true)
    setErroChat(null)
    setErroSalvar(null)

    let textoAcumulado = ''
    try {
      for await (const chunk of enviarChatStream(JSON.stringify(contexto), historico)) {
        textoAcumulado += chunk
        setRespostaStreaming(textoAcumulado)
      }
      const novoHistorico: ChatSessionMessage[] = [
        ...historico,
        { role: 'assistant', content: textoAcumulado },
      ]
      setRespostaStreaming('')
      setMensagens(novoHistorico)
      await persistir(novoHistorico)
    } catch (e) {
      setRespostaStreaming('')
      setErroChat(e instanceof Error ? e.message : 'Falha ao consultar o modelo.')
    } finally {
      setEnviando(false)
    }
  }

  // Carrega uma sessão anterior para continuar a conversa.
  async function selecionarSessao(id: number) {
    if (enviando) return
    try {
      const s = await carregarSessao(id)
      setSessaoAtivaId(s.id)
      setMensagens(s.mensagens ?? [])
      tituloGeradoRef.current.add(s.id) // não regerar título de conversa existente
      setErroChat(null)
      setErroSalvar(null)
    } catch (e) {
      setErroChat(e instanceof Error ? e.message : 'Falha ao carregar a conversa.')
    }
  }

  function novaConversa() {
    setSessaoAtivaId(null)
    setMensagens([])
    setEntrada('')
    setErroChat(null)
    setErroSalvar(null)
  }

  async function renomear(id: number, titulo: string) {
    tituloGeradoRef.current.add(id) // título manual não deve ser sobrescrito
    setSessoes((prev) => prev.map((s) => (s.id === id ? { ...s, titulo } : s)))
    try {
      await renomearSessao(id, titulo)
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : 'Falha ao renomear.')
    }
  }

  async function exportar(id: number) {
    try {
      const s = await carregarSessao(id)
      exportarSessaoMarkdown(s)
    } catch (e) {
      setErroChat(e instanceof Error ? e.message : 'Falha ao exportar.')
    }
  }

  async function excluir(id: number) {
    try {
      await excluirSessao(id)
      setSessoes((prev) => prev.filter((s) => s.id !== id))
      if (id === sessaoAtivaId) novaConversa()
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : 'Falha ao excluir.')
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envia; Shift+Enter quebra linha.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  return (
    <>
    <div className="chat-layout">
      <ChatSidebar
        sessoes={sessoes}
        sessaoAtivaId={sessaoAtivaId}
        onNova={novaConversa}
        onSelecionar={selecionarSessao}
        onRenomear={renomear}
        onExportar={exportar}
        onExcluir={excluir}
      />

      <div className="chat-conversa">
        <div className="chat-bar">
          <div className="chat-bar-info">
            {contexto ? (
              <>
                <strong>{contexto.total}</strong> imóveis no contexto · gerado em{' '}
                {formatarData(contexto.gerado_em)}
              </>
            ) : (
              <span>Nenhum JSON gerado ainda.</span>
            )}
          </div>
          <div className="chat-bar-actions">
            <span className="chat-modelo">{MODELO_PADRAO}</span>
            <button className="btn" onClick={atualizarJson} disabled={gerando}>
              {gerando ? (
                <span className="btn-loading">
                  Atualizando
                  <span className="loader-dot" />
                  <span className="loader-dot" />
                  <span className="loader-dot" />
                </span>
              ) : 'Atualizar JSON'}
            </button>
          </div>
        </div>

        {erroJson && <div className="chat-erro">{erroJson}</div>}

        <div className="chat-mensagens">
          {mensagens.length === 0 && !enviando && (
            <div className="chat-vazio">
              Faça uma pergunta sobre os imóveis. Todo o JSON é enviado como contexto em cada
              mensagem. A conversa é salva automaticamente.
            </div>
          )}
          {mensagens.map((m, i) => {
            const refs = m.role === 'assistant' ? extrairIdsImoveis(m.content) : []
            return (
            <div key={i} className={`chat-msg ${m.role}${refs.length > 0 ? ' has-refs' : ''}`}>
              <div className="chat-bolha">
                {m.role === 'assistant' ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                    {m.content}
                  </ReactMarkdown>
                ) : (
                  m.content
                )}
              </div>
              {refs.length > 0 && (
                <div className="chat-refs">
                  {refs.map((id) => {
                    const im = contexto?.imoveis.find((x) => x.n === id)
                    if (!im) return null
                    return (
                      <button
                        key={id}
                        className={`chat-ref-card ${im.tipo === 'Casa' ? 'casa' : ''}`}
                        onClick={() => setModalImovelId(id)}
                        title={`Ver detalhes do imóvel #${id}`}
                      >
                        <span className="chat-ref-n">#{id}</span>
                        <span className="chat-ref-bairro">{im.bairro}</span>
                        {im.custo != null && <span className="chat-ref-custo">{brl(im.custo)}/mês</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )})}
          {enviando && (
            <div className="chat-msg assistant">
              {respostaStreaming ? (
                <div className="chat-bolha">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                    {respostaStreaming}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="chat-bolha chat-pensando">
                  Pensando
                  <span className="loader-dot" />
                  <span className="loader-dot" />
                  <span className="loader-dot" />
                </div>
              )}
            </div>
          )}
          <div ref={fimRef} />
        </div>

        {erroChat && <div className="chat-erro">{erroChat}</div>}
        {erroSalvar && <div className="chat-erro">{erroSalvar}</div>}

        <div className="chat-entrada">
          <textarea
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ex: Quais imóveis aceitam pet e têm garagem?"
            rows={2}
            disabled={enviando}
          />
          <button
            className="btn btn-enviar"
            onClick={enviar}
            disabled={enviando || !entrada.trim()}
          >
            Enviar
          </button>
        </div>
      </div>
    </div>

    {modalImovelId !== null && (() => {
      const im = contexto?.imoveis.find((x) => x.n === modalImovelId)
      if (!im) return null
      return (
        <Modal onClose={fecharModal}>
          <Card imovel={im} onWhatsapp={onWhatsapp} onStatus={onStatus} onNotas={onNotas} onFavorito={onFavorito} />
        </Modal>
      )
    })()}
    </>
  )
}
