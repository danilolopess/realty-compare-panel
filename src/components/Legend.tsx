export default function Legend() {
  return (
    <div className="legend">
      <strong>Legenda:</strong> 🟩 verde = ponto positivo (aceita pet / tem quintal) · 🟥 vermelho =
      limitação (sem garagem / não aceita pet) · 🟨 amarelo = IPTU estimado (R$ 80) · 🟪 lilás = item
      a verificar com o corretor.
      <br />
      Custo mensal = aluguel + condomínio + IPTU. Use o filtro <b>“Entrar em contato”</b> para ver só
      os imóveis com alguma pendência a confirmar.
    </div>
  )
}
