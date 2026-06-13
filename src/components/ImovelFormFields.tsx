import type { ImovelInput } from '../data'
import type { AceitaPet, TipoImovel } from '../types'

interface Props {
  form: ImovelInput
  setField: <K extends keyof ImovelInput>(key: K, value: ImovelInput[K]) => void
  disabled?: boolean
}

export default function ImovelFormFields({ form, setField, disabled = false }: Props) {
  const avisoLink = !form.link

  return (
    <>
      {avisoLink && (
        <div className="add-imovel-aviso-link">
          ⚠️ O link do anúncio não foi informado. Adicione-o no campo "Link do anúncio" abaixo.
        </div>
      )}

      <div className="add-imovel-form">
        <div className="add-imovel-secao">
          <div className="add-imovel-secao-titulo">Identificação</div>
          <div className="add-imovel-row">
            <div className="add-imovel-field">
              <label>Tipo</label>
              <select
                value={form.tipo_imovel}
                onChange={(e) => setField('tipo_imovel', e.target.value as TipoImovel)}
                disabled={disabled}
              >
                <option value="Apartamento">Apartamento</option>
                <option value="Casa">Casa</option>
              </select>
            </div>
            <div className="add-imovel-field">
              <label>Operação</label>
              <select
                value={form.operacao}
                onChange={(e) => setField('operacao', e.target.value)}
                disabled={disabled}
              >
                <option value="Locação">Locação</option>
                <option value="Venda">Venda</option>
              </select>
            </div>
          </div>
          <div className="add-imovel-row">
            <div className="add-imovel-field">
              <label>Bairro</label>
              <input
                type="text"
                value={form.bairro}
                onChange={(e) => setField('bairro', e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="add-imovel-field">
              <label>Cidade</label>
              <input
                type="text"
                value={form.cidade}
                onChange={(e) => setField('cidade', e.target.value)}
                disabled={disabled}
              />
            </div>
          </div>
          <div className="add-imovel-row">
            <div className="add-imovel-field add-imovel-field--full">
              <label>Imobiliária / Corretor</label>
              <input
                type="text"
                value={form.imobiliaria_corretor}
                onChange={(e) => setField('imobiliaria_corretor', e.target.value)}
                disabled={disabled}
              />
            </div>
          </div>
        </div>

        <div className="add-imovel-secao">
          <div className="add-imovel-secao-titulo">Valores</div>
          <div className="add-imovel-row">
            <div className="add-imovel-field">
              <label>Aluguel (R$)</label>
              <input
                type="number"
                min="0"
                value={form.aluguel}
                onChange={(e) => setField('aluguel', Number(e.target.value))}
                disabled={disabled}
              />
            </div>
            <div className="add-imovel-field">
              <label>Condomínio (R$)</label>
              <input
                type="number"
                min="0"
                value={form.condominio}
                onChange={(e) => setField('condominio', Number(e.target.value))}
                disabled={disabled}
              />
            </div>
            <div className="add-imovel-field">
              <label>IPTU (R$)</label>
              <input
                type="number"
                min="0"
                value={form.iptu}
                onChange={(e) => setField('iptu', Number(e.target.value))}
                disabled={disabled}
              />
            </div>
          </div>
          <div className="add-imovel-row">
            <div className="add-imovel-field add-imovel-field--check">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={form.iptu_estimado}
                  onChange={(e) => setField('iptu_estimado', e.target.checked)}
                  disabled={disabled}
                />
                IPTU estimado
              </label>
            </div>
            <div className="add-imovel-field">
              <label>Valor de venda (R$)</label>
              <input
                type="number"
                min="0"
                value={form.venda ?? ''}
                onChange={(e) => setField('venda', e.target.value ? Number(e.target.value) : null)}
                disabled={disabled}
              />
            </div>
          </div>
        </div>

        <div className="add-imovel-secao">
          <div className="add-imovel-secao-titulo">Características</div>
          <div className="add-imovel-row">
            <div className="add-imovel-field">
              <label>Quartos</label>
              <input
                type="number"
                min="0"
                value={form.quartos ?? ''}
                onChange={(e) => setField('quartos', e.target.value ? Number(e.target.value) : null)}
                disabled={disabled}
              />
            </div>
            <div className="add-imovel-field">
              <label>Banheiros</label>
              <input
                type="number"
                min="0"
                value={form.banheiros ?? ''}
                onChange={(e) => setField('banheiros', e.target.value ? Number(e.target.value) : null)}
                disabled={disabled}
              />
            </div>
            <div className="add-imovel-field">
              <label>Área (m²)</label>
              <input
                type="number"
                min="0"
                value={form.area_m2 ?? ''}
                onChange={(e) => setField('area_m2', e.target.value ? Number(e.target.value) : null)}
                disabled={disabled}
              />
            </div>
          </div>
          <div className="add-imovel-row">
            <div className="add-imovel-field">
              <label>Vagas garagem</label>
              <input
                type="number"
                min="0"
                value={form.garagem_vagas ?? ''}
                onChange={(e) =>
                  setField('garagem_vagas', e.target.value ? Number(e.target.value) : null)
                }
                disabled={disabled}
              />
            </div>
            <div className="add-imovel-field">
              <label>Detalhe garagem</label>
              <input
                type="text"
                value={form.garagem_detalhe}
                onChange={(e) => setField('garagem_detalhe', e.target.value)}
                disabled={disabled}
              />
            </div>
          </div>
          <div className="add-imovel-row">
            <div className="add-imovel-field">
              <label>Aceita pet</label>
              <select
                value={form.aceita_pet}
                onChange={(e) => setField('aceita_pet', e.target.value as AceitaPet)}
                disabled={disabled}
              >
                <option value="nao_informado">Não informado</option>
                <option value="aceita">Aceita</option>
                <option value="nao_permite">Não permite</option>
              </select>
            </div>
            <div className="add-imovel-field add-imovel-field--check">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={form.quintal_tem ?? false}
                  onChange={(e) => setField('quintal_tem', e.target.checked)}
                  disabled={disabled}
                />
                Tem quintal
              </label>
            </div>
          </div>
        </div>

        <div className="add-imovel-secao">
          <div className="add-imovel-secao-titulo">Contato</div>
          <div className="add-imovel-row">
            <div className="add-imovel-field add-imovel-field--full">
              <label>Link do anúncio</label>
              <input
                type="text"
                value={form.link}
                onChange={(e) => setField('link', e.target.value)}
                style={avisoLink ? { borderColor: '#dcb53a' } : undefined}
                disabled={disabled}
              />
            </div>
          </div>
          <div className="add-imovel-row">
            <div className="add-imovel-field add-imovel-field--full">
              <label>WhatsApp (DDI + DDD + número)</label>
              <input
                type="text"
                value={form.whatsapp ?? ''}
                onChange={(e) => setField('whatsapp', e.target.value ? e.target.value : null)}
                disabled={disabled}
              />
            </div>
          </div>
        </div>

        <div className="add-imovel-secao">
          <div className="add-imovel-secao-titulo">Observações</div>
          <div className="add-imovel-field add-imovel-field--full">
            <label>Observações</label>
            <textarea
              className="add-imovel-textarea"
              rows={3}
              value={form.observacoes}
              onChange={(e) => setField('observacoes', e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="add-imovel-field add-imovel-field--full">
            <label>A verificar</label>
            <input
              type="text"
              value={form.a_verificar ?? ''}
              onChange={(e) => setField('a_verificar', e.target.value ? e.target.value : null)}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </>
  )
}
