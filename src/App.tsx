import { useState } from 'react'
import Painel from './components/Painel'
import Chat from './components/Chat'
import Workflow from './components/Workflow'
import Rankings from './components/Rankings'

type Aba = 'painel' | 'favoritos' | 'workflow' | 'rankings' | 'chat'

export default function App() {
  const [aba, setAba] = useState<Aba>('painel')

  return (
    <>
      <nav className="tabs">
        <button
          className={`tab ${aba === 'painel' ? 'active' : ''}`}
          onClick={() => setAba('painel')}
        >
          Painel
        </button>
        <button
          className={`tab ${aba === 'favoritos' ? 'active' : ''}`}
          onClick={() => setAba('favoritos')}
        >
          Favoritos
        </button>
        <button
          className={`tab ${aba === 'workflow' ? 'active' : ''}`}
          onClick={() => setAba('workflow')}
        >
          Flow
        </button>
        <button
          className={`tab ${aba === 'rankings' ? 'active' : ''}`}
          onClick={() => setAba('rankings')}
        >
          Rankings
        </button>
        <button
          className={`tab ${aba === 'chat' ? 'active' : ''}`}
          onClick={() => setAba('chat')}
        >
          Chat
        </button>
      </nav>

      {aba === 'painel' && <Painel key="painel" />}
      {aba === 'favoritos' && <Painel key="favoritos" somenteFavoritos />}
      {aba === 'workflow' && <Workflow />}
      {aba === 'rankings' && <Rankings />}
      {aba === 'chat' && <Chat />}
    </>
  )
}
