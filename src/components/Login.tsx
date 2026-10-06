import { useState, type FormEvent } from 'react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: senha }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setErro(data.error ?? 'Email ou senha inválidos.')
        setEnviando(false)
        return
      }
      window.location.assign('/')
    } catch {
      setErro('Não foi possível entrar. Tente de novo.')
      setEnviando(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={(e) => void aoEnviar(e)}>
        <p className="login-kicker">Acesso reservado</p>
        <h1>Entrar</h1>
        <p className="sub">Painel de imóveis</p>
        <div className="login-campo">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="login-campo">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>
        {erro ? (
          <p className="login-erro" role="alert">
            {erro}
          </p>
        ) : null}
        <button className="btn" type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
