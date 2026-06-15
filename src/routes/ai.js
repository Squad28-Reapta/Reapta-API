import express from "express";
import sql from "../db.js";
import { gerarRespostaIA } from "../services/ai.js";

const router = express.Router();

router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: "Mensagem obrigatória" });
    }

    // Produtos ativos
    const produtos = await sql`
      SELECT id, sku, nome, categoria, fabricante, cor, tamanho,
             preco_atual, estoque_atual, estoque_minimo
      FROM produto
      WHERE ativo = true
    `;

    // Últimas 30 vendas com nome do vendedor
    const vendas = await sql`
      SELECT v.id, v.data_venda, v.status, v.valor_total,
             v.desconto_total, v.cidade, v.estado,
             u.nome AS vendedor
      FROM venda v
      JOIN usuario u ON u.id = v.vendedor_id
      ORDER BY v.data_venda DESC
      LIMIT 30
    `;

    // Métricas gerais
    const [metricas] = await sql`
      SELECT
        COUNT(*)::int                                                        AS total_pedidos,
        COALESCE(SUM(valor_total), 0)::float                                AS total_faturamento,
        COALESCE(AVG(valor_total), 0)::float                                AS ticket_medio,
        COUNT(*) FILTER (WHERE status = 'cancelada')::int                   AS pedidos_cancelados,
        COUNT(*) FILTER (WHERE status = 'concluida')::int                   AS pedidos_concluidos,
        COUNT(*) FILTER (WHERE status = 'pendente')::int                    AS pedidos_pendentes
      FROM venda
    `;

    // Movimentação de produtos (item_venda)
    const movimentacaoProdutos = await sql`
      SELECT
        p.nome                                                               AS produto,
        p.categoria,
        SUM(iv.quantidade)::int                                              AS total_vendido,
        SUM(iv.quantidade * iv.preco_unitario)::float                        AS receita_bruta,
        SUM(iv.quantidade * iv.desconto)::float                              AS total_descontos,
        SUM(iv.quantidade * (iv.preco_unitario - iv.desconto))::float        AS receita_liquida,
        COUNT(DISTINCT iv.venda_id)::int                                     AS aparece_em_vendas
      FROM item_venda iv
      JOIN produto p ON p.id = iv.produto_id
      JOIN venda v ON v.id = iv.venda_id
      WHERE v.status = 'concluida'
      GROUP BY p.id, p.nome, p.categoria
      ORDER BY total_vendido DESC
    `;

    // Ranking de vendedores no mês atual
    const rankingVendedores = await sql`
      SELECT
        u.nome                                                               AS vendedor,
        u.perfil,
        COUNT(v.id)::int                                                     AS total_vendas,
        COALESCE(SUM(v.valor_total), 0)::float                              AS total_faturado,
        COALESCE(AVG(v.valor_total), 0)::float                              AS ticket_medio
      FROM usuario u
      JOIN venda v ON v.vendedor_id = u.id
      WHERE v.status = 'concluida'
        AND DATE_TRUNC('month', v.data_venda) = DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY u.id, u.nome, u.perfil
      ORDER BY total_faturado DESC
    `;

    // Movimentação de estoque (entradas/saídas/ajustes)
    const movimentacaoEstoque = await sql`
      SELECT
        p.nome                                                               AS produto,
        me.tipo,
        me.quantidade,
        me.origem,
        me.registrado_em,
        u.nome                                                               AS registrado_por
      FROM movimentacao_estoque me
      JOIN produto p ON p.id = me.produto_id
      JOIN usuario u ON u.id = me.registrado_por
      ORDER BY me.registrado_em DESC
      LIMIT 50
    `;

    const contexto = `
PRODUTOS ATIVOS (${produtos.length}):
${JSON.stringify(produtos, null, 2)}

ÚLTIMAS 30 VENDAS:
${JSON.stringify(vendas, null, 2)}

MÉTRICAS GERAIS:
${JSON.stringify(metricas, null, 2)}

MOVIMENTAÇÃO DE PRODUTOS (vendas concluídas):
${JSON.stringify(movimentacaoProdutos, null, 2)}

RANKING DE VENDEDORES (mês atual):
${JSON.stringify(rankingVendedores, null, 2)}

MOVIMENTAÇÃO DE ESTOQUE (últimas 50):
${JSON.stringify(movimentacaoEstoque, null, 2)}
    `;

    const reply = await gerarRespostaIA(message, contexto);

    res.json({ success: true, resposta: reply });
  } catch (error) {
    console.error("[ERRO /ai/chat]", error);
    res.status(500).json({ success: false, error: "Erro ao gerar resposta da IA" });
  }
});

export default router;