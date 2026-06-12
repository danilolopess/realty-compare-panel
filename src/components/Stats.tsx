import { brl } from '../data'
import type { Imovel } from '../types'

interface Props {
  lista: Imovel[]
}

export default function Stats({ lista }: Props) {
  const comCusto = lista.filter((i) => i.custo != null)
  if (!comCusto.length) return <div className="stats" />

  const custos = comCusto.map((i) => i.custo as number)
  const med = custos.reduce((a, b) => a + b, 0) / custos.length

  return (
    <div className="stats">
      <div className="stat">
        <div className="v">{lista.length}</div>
        <div className="l">Imóveis</div>
      </div>
      <div className="stat">
        <div className="v">{brl(Math.min(...custos))}</div>
        <div className="l">Menor custo/mês</div>
      </div>
      <div className="stat">
        <div className="v">{brl(med)}</div>
        <div className="l">Custo médio/mês</div>
      </div>
      <div className="stat">
        <div className="v">{brl(Math.max(...custos))}</div>
        <div className="l">Maior custo/mês</div>
      </div>
    </div>
  )
}
