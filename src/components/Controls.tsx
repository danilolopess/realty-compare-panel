import type { FilterState, SortKey } from '../types'

interface FiltrosVisiveis {
  tipo: boolean
  cidade: boolean
  bairro: boolean
  garagem: boolean
  quintal: boolean
  pet: boolean
  contato: boolean
}

interface Props {
  state: FilterState
  onChange: (patch: Partial<FilterState>) => void
  bairros: string[]
  tipos: string[]
  cidades: string[]
  filtrosVisiveis: FiltrosVisiveis
}

export default function Controls({ state, onChange, bairros, tipos, cidades, filtrosVisiveis }: Props) {
  return (
    <div className="controls">
      <div className="ctrl">
        <label>Buscar</label>
        <input
          type="text"
          placeholder="bairro, corretor, descrição..."
          value={state.busca}
          onChange={(e) => onChange({ busca: e.target.value })}
        />
      </div>

      {filtrosVisiveis.tipo && (
        <div className="ctrl">
          <label>Tipo de imóvel</label>
          <div className="chips">
            <span
              className={'chip' + (state.tipo === 'todos' ? ' active' : '')}
              onClick={() => onChange({ tipo: 'todos' })}
            >
              Todos
            </span>
            {tipos.map((t) => (
              <span
                key={t}
                className={'chip' + (state.tipo === t ? ' active' : '')}
                onClick={() => onChange({ tipo: t })}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {filtrosVisiveis.cidade && (
        <div className="ctrl">
          <label>Cidade</label>
          <div className="chips">
            <span
              className={'chip' + (state.cidade === 'todos' ? ' active' : '')}
              onClick={() => onChange({ cidade: 'todos' })}
            >
              Todas
            </span>
            {cidades.map((c) => (
              <span
                key={c}
                className={'chip' + (state.cidade === c ? ' active' : '')}
                onClick={() => onChange({ cidade: c })}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {filtrosVisiveis.bairro && (
        <div className="ctrl">
          <label>Bairro</label>
          <select value={state.bairro} onChange={(e) => onChange({ bairro: e.target.value })}>
            <option value="todos">Todos</option>
            {bairros.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="ctrl">
        <label>Status</label>
        <select value={state.status} onChange={(e) => onChange({ status: e.target.value })}>
          <option value="todos">Todos (exceto inviabilizados)</option>
          <option value="nao_analisado">Não analisado</option>
          <option value="aguardando">Aguardando resposta</option>
          <option value="inviabilizado">Inviabilizado</option>
        </select>
      </div>

      <div className="ctrl">
        <label>Ordenar por</label>
        <select
          value={state.sort}
          onChange={(e) => onChange({ sort: e.target.value as SortKey })}
        >
          <option value="custo">Custo mensal (menor→maior)</option>
          <option value="custo-desc">Custo mensal (maior→menor)</option>
          <option value="aluguel">Aluguel (menor→maior)</option>
          <option value="quartos-desc">Mais quartos</option>
          <option value="area-desc">Maior área</option>
        </select>
      </div>

      {filtrosVisiveis.garagem && (
        <div className="ctrl">
          <label>Garagem</label>
          <select value={state.garagem} onChange={(e) => onChange({ garagem: e.target.value })}>
            <option value="todos">Indiferente</option>
            <option value="sim">Com garagem</option>
            <option value="nao">Sem garagem</option>
          </select>
        </div>
      )}

      {filtrosVisiveis.quintal && (
        <div className="ctrl">
          <label>Quintal / área externa</label>
          <select value={state.quintal} onChange={(e) => onChange({ quintal: e.target.value })}>
            <option value="todos">Indiferente</option>
            <option value="sim">Com quintal / área externa</option>
          </select>
        </div>
      )}

      {filtrosVisiveis.pet && (
        <div className="ctrl">
          <label>Aceita pet</label>
          <select value={state.pet} onChange={(e) => onChange({ pet: e.target.value })}>
            <option value="todos">Indiferente</option>
            <option value="sim">Aceita pet</option>
          </select>
        </div>
      )}

      {filtrosVisiveis.contato && (
        <div className="ctrl">
          <label>Entrar em contato</label>
          <select value={state.contato} onChange={(e) => onChange({ contato: e.target.value })}>
            <option value="todos">Indiferente</option>
            <option value="sim">Só com pendência de contato</option>
          </select>
        </div>
      )}

      <div className="ctrl">
        <label>Custo mensal até (R$)</label>
        <input
          type="text"
          placeholder="ex: 1200"
          inputMode="numeric"
          onChange={(e) =>
            onChange({ max: parseFloat(e.target.value.replace(/\D/g, '')) || null })
          }
        />
      </div>
    </div>
  )
}
