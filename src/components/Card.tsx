import { useState } from 'react'
import { brl, linkWhatsapp, tempoRelativo } from '../data'
import { STATUS_LABEL, montaFeats } from './feats'
import type { Imovel, StatusImovel } from '../types'

interface Props {
  imovel: Imovel
  onWhatsapp: (id: number, numero: string) => void | Promise<void>
  onStatus: (id: number, status: StatusImovel) => void | Promise<void>
  onNotas: (id: number, notas: string) => void | Promise<void>
  onFavorito: (id: number, favorito: boolean) => void | Promise<void>
}

export default function Card({ imovel: i, onWhatsapp, onStatus, onNotas, onFavorito }: Props) {
  const [editando, setEditando] = useState(false)
  const [numero, setNumero] = useState(i.whatsapp ?? '')
  const [notas, setNotas] = useState(i.notas ?? '')

  const salvar = async () => {
    await onWhatsapp(i.n, numero)
    setEditando(false)
  }
  const cls = i.tipo === 'Casa' ? 'casa' : ''
  const btipo = i.tipo === 'Casa' ? 'b-casa' : 'b-apto'

  const feats = montaFeats(i)

  return (
    <div className={`card ${cls}`}>
      <div className="card-main">
        <div className="card-head">
          <span className={`badge ${btipo}`}>{i.tipo}</span>
          <button
            className={`fav-btn ${i.favorito ? 'on' : ''}`}
            onClick={() => onFavorito(i.n, !i.favorito)}
            aria-label={i.favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            title={i.favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            {i.favorito ? '❤️' : '🤍'}
            {!i.favorito && <span className="fav-label">Adicionar aos favoritos</span>}
          </button>
        </div>
        <h3>
          #{i.n} · {i.bairro}
        </h3>
        <div style={{ fontSize: '.74rem', color: '#888' }}>
          {i.corretor} · {i.op} · 📍{i.cidade}
        </div>

        <div className="feats">{feats}</div>

        {i.verif && <div className="verif">⚠️ {i.verif}</div>}

        <div className="obs">{i.obs}</div>

        <div className="notas">
          <label className="notas-label">📝 Notas</label>
          <textarea
            className="notas-area"
            placeholder="Anotações sobre este imóvel..."
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            onBlur={() => {
              if (notas !== (i.notas ?? '')) onNotas(i.n, notas)
            }}
          />
        </div>
      </div>

      <div className="card-side">
        {i.semDados ? (
          <div className="price" style={{ fontSize: '1.1rem', color: '#8a6d00' }}>
            Preço a confirmar
          </div>
        ) : (
          <>
            <div className="price">
              {brl(i.custo as number)}
              <small>/mês total</small>
            </div>
            <div className="breakdown">
              Aluguel {brl(i.aluguel)} · Cond. {i.cond ? brl(i.cond) : '—'} · IPTU{' '}
              {i.iptu ? brl(i.iptu) : 'incluso'}
            </div>
          </>
        )}

        {i.venda != null && (
          <div className="breakdown">
            💰 Venda: <b>{brl(i.venda)}</b>
          </div>
        )}

        <a className="link" href={i.link} target="_blank" rel="noreferrer">
          Ver anúncio →
        </a>

        <div className="status-box">
          <select
            className={`status-select status-${i.status}`}
            value={i.status}
            onChange={(e) => onStatus(i.n, e.target.value as StatusImovel)}
          >
            {(Object.keys(STATUS_LABEL) as StatusImovel[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {i.status === 'aguardando' && i.statusEm && (
            <span className="status-tempo">⏳ aguardando {tempoRelativo(i.statusEm)}</span>
          )}
        </div>

        <div className="zap">
          {i.whatsapp && !editando ? (
            <>
              <a
                className="zap-link"
                href={linkWhatsapp(i.whatsapp)}
                target="_blank"
                rel="noreferrer"
              >
                💬 WhatsApp
              </a>
              <button className="zap-edit" onClick={() => setEditando(true)}>
                editar
              </button>
            </>
          ) : (
            <div className="zap-form">
              <input
                type="text"
                placeholder="WhatsApp (DDI + DDD + número)"
                inputMode="numeric"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
              <button className="zap-save" onClick={salvar}>
                Salvar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
