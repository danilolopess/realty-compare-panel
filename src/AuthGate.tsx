import { useEffect, useState } from 'react'
import App from './App'
import Login from './components/Login'
import { obterSessao, type Sessao } from './authClient'

export default function AuthGate() {
  const [sessao, setSessao] = useState<Sessao | null>(null)
  const caminho = window.location.pathname

  const noLogin = caminho === '/login' || caminho === '/login/'

  useEffect(() => {
    let ativo = true
    void obterSessao().then((proxima) => {
      if (ativo) setSessao(proxima)
    })
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    if (sessao === null) return
    if (noLogin && sessao.loggedIn) window.location.replace('/')
    else if (!noLogin && !sessao.loggedIn) window.location.replace('/login')
  }, [sessao, noLogin])

  if (sessao === null) return <p className="empty">Carregando…</p>

  if (noLogin) {
    if (sessao.loggedIn) return <p className="empty">Carregando…</p>
    return <Login />
  }

  if (!sessao.loggedIn) return <p className="empty">Carregando…</p>

  return <App />
}
