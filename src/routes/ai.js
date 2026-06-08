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

    // Busca dados do banco
    const produtos = await sql`SELECT id, nome, categoria, preco_atual, estoque_atual, estoque_minimo FROM produto WHERE ativo = true`;
    const vendas = await sql`SELECT id, valor_total, status, data_venda FROM venda ORDER BY data_venda DESC LIMIT 20`;
    const [metricas] = await sql`
      SELECT
        COUNT(*)::int AS total_pedidos,
        COALESCE(SUM(valor_total), 0)::float AS total_faturamento,
        COALESCE(AVG(valor_total), 0)::float AS ticket_medio,
        COUNT(*) FILTER (WHERE status = 'cancelada')::int AS pedidos_cancelados,
        COUNT(*) FILTER (WHERE status = 'concluida')::int AS pedidos_concluidos,
        COUNT(*) FILTER (WHERE status = 'pendente')::int AS pedidos_pendentes
      FROM venda
    `;

    const contexto = `
PRODUTOS (${produtos.length} ativos):
${JSON.stringify(produtos, null, 2)}

ÚLTIMAS 20 VENDAS:
${JSON.stringify(vendas, null, 2)}

MÉTRICAS GERAIS:
${JSON.stringify(metricas, null, 2)}
    `;

    const reply = await gerarRespostaIA(message, contexto);

    res.json({ success: true, reply });
  } catch (error) {
    console.error("[ERRO /ai/chat]", error);
    res.status(500).json({ success: false, error: "Erro ao gerar resposta da IA" });
  }
});

export default router;