import { useState, type FormEvent } from 'react'

const MIN_SENHA = 8

export default function Configuracoes() {
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    setOk(null)
    try {
      const res = await fetch('/api/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current: atual, next: nova, confirm: confirmacao }),
      })
      const data = (await res.json()) as { ok?: string; error?: string }
      if (!res.ok || !data.ok) {
        setErro(data.error ?? 'Não foi possível salvar a senha.')
        setEnviando(false)
        return
      }
      setOk(data.ok)
      setAtual('')
      setNova('')
      setConfirmacao('')
      setEnviando(false)
    } catch {
      setErro('Não foi possível salvar a senha.')
      setEnviando(false)
    }
  }

  return (
    <form className="login-card config-card" onSubmit={(e) => void aoEnviar(e)}>
      <h1>Configurações</h1>
      <p className="sub">Trocar a senha de acesso</p>
      <div className="login-campo">
        <label htmlFor="current">Senha atual</label>
        <input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
          value={atual}
          onChange={(e) => setAtual(e.target.value)}
        />
      </div>
      <div className="login-campo">
        <label htmlFor="next">Nova senha</label>
        <input
          id="next"
          name="next"
          type="password"
          autoComplete="new-password"
          minLength={MIN_SENHA}
          required
          value={nova}
          onChange={(e) => setNova(e.target.value)}
        />
      </div>
      <div className="login-campo">
        <label htmlFor="confirm">Confirmar nova senha</label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={MIN_SENHA}
          required
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
        />
      </div>
      {erro ? (
        <p className="login-erro" role="alert">
          {erro}
        </p>
      ) : null}
      {ok ? (
        <p className="login-ok" role="status">
          {ok}
        </p>
      ) : null}
      <button className="btn" type="submit" disabled={enviando}>
        {enviando ? 'Salvando…' : 'Salvar senha'}
      </button>
    </form>
  )
}
