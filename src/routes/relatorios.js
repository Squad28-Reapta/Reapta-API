import express from 'express';
import sql from '../db.js';

const router = express.Router();

// GET /api/v1/relatorios/metricas?de=YYYY-MM-DD&ate=YYYY-MM-DD&status=
router.get('/metricas', async (req, res) => {
  try {
    const { de, ate, status } = req.query;

    const [metricas] = await sql`
      SELECT
        COUNT(*)::int                                           AS total_pedidos,
        COALESCE(SUM(valor_total), 0)::float                  AS total_faturamento,
        COALESCE(AVG(valor_total), 0)::float                  AS ticket_medio,
        COUNT(*) FILTER (WHERE status = 'cancelada')::int     AS pedidos_cancelados,
        COUNT(*) FILTER (WHERE status = 'concluida')::int     AS pedidos_concluidos,
        COUNT(*) FILTER (WHERE status = 'pendente')::int      AS pedidos_pendentes
      FROM venda
      WHERE ${de ? sql`data_venda >= ${de}::date` : sql`true`}
        AND ${ate ? sql`data_venda <= ${ate}::date` : sql`true`}
        AND ${status ? sql`status = ${status}` : sql`true`}
    `;

    const [estoqueRow] = await sql`
      SELECT COUNT(*)::int AS produtos_estoque_baixo
      FROM produto
      WHERE ativo = true AND estoque_atual <= estoque_minimo
    `;

    res.json({
      success: true,
      data: {
        ...metricas,
        produtos_estoque_baixo: estoqueRow.produtos_estoque_baixo,
      }
    });
  } catch (error) {
    console.error('[ERRO GET /relatorios/metricas]', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao buscar métricas' }
    });
  }
});

// GET /api/v1/relatorios/serie?de=YYYY-MM-DD&ate=YYYY-MM-DD
// Retorna agregação diária de vendas no período
router.get('/serie', async (req, res) => {
  try {
    const { de, ate } = req.query;

    const serie = await sql`
      SELECT
        TO_CHAR(data_venda, 'DD/MM')                      AS dia,
        DATE(data_venda)                                   AS data,
        COUNT(*)::int                                      AS quantidade,
        COALESCE(SUM(valor_total), 0)::float               AS faturamento
      FROM venda
      WHERE ${de ? sql`data_venda >= ${de}::date` : sql`true`}
        AND ${ate ? sql`data_venda <= ${ate}::date` : sql`true`}
      GROUP BY DATE(data_venda), TO_CHAR(data_venda, 'DD/MM')
      ORDER BY DATE(data_venda) ASC
    `;

    res.json({ success: true, data: serie });
  } catch (error) {
    console.error('[ERRO GET /relatorios/serie]', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao buscar série temporal' }
    });
  }
});

// GET /api/v1/relatorios/semanal?de=YYYY-MM-DD&ate=YYYY-MM-DD
// Retorna agregação semanal de faturamento
router.get('/semanal', async (req, res) => {
  try {
    const { de, ate } = req.query;

    const semanal = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('week', data_venda), 'DD/MM') AS semana,
        DATE_TRUNC('week', data_venda)                    AS semana_inicio,
        COUNT(*)::int                                     AS quantidade,
        COALESCE(SUM(valor_total), 0)::float              AS total
      FROM venda
      WHERE ${de ? sql`data_venda >= ${de}::date` : sql`true`}
        AND ${ate ? sql`data_venda <= ${ate}::date` : sql`true`}
      GROUP BY DATE_TRUNC('week', data_venda)
      ORDER BY semana_inicio ASC
      LIMIT 8
    `;

    res.json({ success: true, data: semanal });
  } catch (error) {
    console.error('[ERRO GET /relatorios/semanal]', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao buscar dados semanais' }
    });
  }
});

export default router;
