export type Sessao =
  | { loggedIn: true; email: string }
  | { loggedIn: false }

export async function obterSessao(): Promise<Sessao> {
  const res = await fetch('/api/session')
  if (!res.ok) return { loggedIn: false }
  const data = (await res.json()) as Sessao
  if (data.loggedIn === true && typeof data.email === 'string') return data
  return { loggedIn: false }
}
