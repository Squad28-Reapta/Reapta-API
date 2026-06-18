import express from 'express';
import sql from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { de, ate, estado, vendedor_id } = req.query;

    let vendas;

    if (de && ate && estado && vendedor_id) {
      vendas = await sql`
        SELECT v.*, c.nome AS cliente_nome
        FROM venda v
        LEFT JOIN clientes c ON v.fk_cliente = c.id
        WHERE v.data_venda >= ${de} AND v.data_venda <= ${ate} AND v.estado = ${estado} AND v.vendedor_id = ${vendedor_id}
      `;
    } else if (de && ate && estado) {
      vendas = await sql`
        SELECT v.*, c.nome AS cliente_nome
        FROM venda v
        LEFT JOIN clientes c ON v.fk_cliente = c.id
        WHERE v.data_venda >= ${de} AND v.data_venda <= ${ate} AND v.estado = ${estado}
      `;
    } else if (de && ate && vendedor_id) {
      vendas = await sql`
        SELECT v.*, c.nome AS cliente_nome
        FROM venda v
        LEFT JOIN clientes c ON v.fk_cliente = c.id
        WHERE v.data_venda >= ${de} AND v.data_venda <= ${ate} AND v.vendedor_id = ${vendedor_id}
      `;
    } else if (de && ate) {
      vendas = await sql`
        SELECT v.*, c.nome AS cliente_nome
        FROM venda v
        LEFT JOIN clientes c ON v.fk_cliente = c.id
        WHERE v.data_venda >= ${de} AND v.data_venda <= ${ate}
      `;
    } else if (estado) {
      vendas = await sql`
        SELECT v.*, c.nome AS cliente_nome
        FROM venda v
        LEFT JOIN clientes c ON v.fk_cliente = c.id
        WHERE v.estado = ${estado}
      `;
    } else if (vendedor_id) {
      vendas = await sql`
        SELECT v.*, c.nome AS cliente_nome
        FROM venda v
        LEFT JOIN clientes c ON v.fk_cliente = c.id
        WHERE v.vendedor_id = ${vendedor_id}
      `;
    } else {
      vendas = await sql`
        SELECT v.*, c.nome AS cliente_nome
        FROM venda v
        LEFT JOIN clientes c ON v.fk_cliente = c.id
      `;
    }

    if (vendas.length === 0) {
      return res.json({ success: true, data: [], message: 'Nenhuma venda encontrada' });
    }

    res.json({ success: true, data: vendas });
  } catch (error) {
    console.error('[ERRO GET /vendas]', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao buscar vendas' }
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [venda] = await sql`
      SELECT v.*, u.nome AS vendedor_nome, c.nome AS cliente_nome, c.cpf_cnpj AS cliente_cpf_cnpj, c.email AS cliente_email, c.telefone AS cliente_telefone
      FROM venda v
      LEFT JOIN usuario u ON v.vendedor_id = u.id
      LEFT JOIN clientes c ON v.fk_cliente = c.id
      WHERE v.id = ${id}
    `;

    if (!venda) {
      return res.status(404).json({
        success: false,
        error: { code: 'NAO_ENCONTRADO', message: 'Venda não encontrada' }
      });
    }

    const itens = await sql`
      SELECT
        iv.id,
        iv.produto_id,
        iv.quantidade,
        iv.preco_unitario,
        iv.desconto,
        p.nome AS produto_nome,
        p.sku AS produto_sku,
        p.categoria AS produto_categoria
      FROM item_venda iv
      JOIN produto p ON p.id = iv.produto_id
      WHERE iv.venda_id = ${id}
    `;

    res.json({ success: true, data: { ...venda, itens } });
  } catch (error) {
    console.error('[ERRO GET /vendas/:id]', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao buscar venda' }
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const vendedor_id = req.usuario.id;
    const { itens, cidade, estado, desconto_total, cliente_id } = req.body;

    if (!itens || itens.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'CAMPOS_OBRIGATORIOS', message: 'A venda deve conter pelo menos um item' }
      });
    }

    if (cliente_id) {
      const [clienteExiste] = await sql`SELECT id FROM clientes WHERE id = ${cliente_id}`;
      if (!clienteExiste) {
        return res.status(404).json({
          success: false,
          error: { code: 'NAO_ENCONTRADO', message: 'Cliente não encontrado' }
        });
      }
    }

    for (const item of itens) {
      const [produto] = await sql`SELECT * FROM produto WHERE id = ${item.produto_id} AND ativo = true`;

      if (!produto) {
        return res.status(404).json({
          success: false,
          error: { code: 'NAO_ENCONTRADO', message: `Produto ${item.produto_id} não encontrado` }
        });
      }

      if (produto.estoque_atual < item.quantidade) {
        return res.status(422).json({
          success: false,
          error: { code: 'ESTOQUE_INSUFICIENTE', message: `Estoque insuficiente para o produto ${produto.nome}` }
        });
      }
    }

    let valor_total = 0;
    for (const item of itens) {
      valor_total += item.preco_unitario * item.quantidade - (item.desconto ?? 0);
    }
    valor_total -= desconto_total ?? 0;

    const [venda] = await sql`
      INSERT INTO venda (vendedor_id, fk_cliente, valor_total, desconto_total, cidade, estado)
      VALUES (${vendedor_id}, ${cliente_id ?? null}, ${valor_total}, ${desconto_total ?? 0}, ${cidade ?? null}, ${estado ?? null})
      RETURNING *
    `;

    for (const item of itens) {
      await sql`
        INSERT INTO item_venda (venda_id, produto_id, quantidade, preco_unitario, desconto)
        VALUES (${venda.id}, ${item.produto_id}, ${item.quantidade}, ${item.preco_unitario}, ${item.desconto ?? 0})
      `;

      await sql`
        UPDATE produto SET estoque_atual = estoque_atual - ${item.quantidade} WHERE id = ${item.produto_id}
      `;

      const [produto] = await sql`SELECT * FROM produto WHERE id = ${item.produto_id}`;
      if (produto.estoque_atual <= produto.estoque_minimo) {
        await sql`
          INSERT INTO sugestao_ia (tipo, produto_id, descricao, status)
          VALUES ('reposicao', ${produto.id}, ${'Estoque baixo para o produto ' + produto.nome}, 'pendente')
        `;
      }
    }

    res.status(201).json({ success: true, data: venda });
  } catch (error) {
    console.error('[ERRO POST /vendas]', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao criar venda' }
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const statusValidos = ['pendente', 'concluida', 'cancelada'];
    if (!status || !statusValidos.includes(status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'STATUS_INVALIDO', message: 'Status deve ser: pendente, concluida ou cancelada' }
      });
    }

    const [existe] = await sql`SELECT id FROM venda WHERE id = ${id}`;
    if (!existe) {
      return res.status(404).json({
        success: false,
        error: { code: 'NAO_ENCONTRADO', message: 'Venda não encontrada' }
      });
    }

    const [atualizada] = await sql`
      UPDATE venda SET status = ${status} WHERE id = ${id} RETURNING *
    `;

    res.json({ success: true, data: atualizada });
  } catch (error) {
    console.error('[ERRO PUT /vendas/:id]', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao atualizar venda' }
    });
  }
});

export default router;