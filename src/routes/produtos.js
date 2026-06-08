import express from 'express';
import sql from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const nome = req.query.nome ? `%${req.query.nome}%` : '%';
    const categoria = req.query.categoria ? `%${req.query.categoria}%` : '%';
    const sku = req.query.sku ? `%${req.query.sku}%` : '%';

    const produtos = await sql`
      SELECT * FROM produto
      WHERE ativo = true
        AND nome ILIKE ${nome}
        AND categoria ILIKE ${categoria}
        AND sku ILIKE ${sku}
    `;

    if (produtos.length === 0) {
      return res.json({ success: true, data: [], message: 'Nenhum produto encontrado' });
    }

    res.json({ success: true, data: produtos });
  } catch (error) {
    console.error('[ERRO GET /produtos]', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao buscar produtos' }
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [produto] = await sql`
      SELECT * FROM produto WHERE id = ${id} AND ativo = true
    `;

    if (!produto) {
      return res.status(404).json({
        success: false,
        error: { code: 'NAO_ENCONTRADO', message: 'Produto não encontrado' }
      });
    }

    res.json({ success: true, data: produto });
  } catch (error) {
    console.error('[ERRO GET /produtos/:id]', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao buscar produto' }
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { sku, nome, descricao, categoria, fabricante, cor, tamanho, preco_atual, estoque_atual, estoque_minimo } = req.body;

    if (!sku || !nome || preco_atual === undefined) {
      return res.status(400).json({
        success: false,
        error: { code: 'CAMPOS_OBRIGATORIOS', message: 'sku, nome e preco_atual são obrigatórios' }
      });
    }

    if (preco_atual <= 0) {
      return res.status(422).json({
        success: false,
        error: { code: 'PRECO_INVALIDO', message: 'O preço deve ser maior que zero' }
      });
    }

    if ((estoque_atual ?? 0) < 0) {
      return res.status(422).json({
        success: false,
        error: { code: 'ESTOQUE_INVALIDO', message: 'Estoque não pode ser negativo' }
      });
    }

    const [existente] = await sql`SELECT id FROM produto WHERE sku = ${sku}`;
    if (existente) {
      return res.status(409).json({
        success: false,
        error: { code: 'SKU_DUPLICADO', message: 'Já existe um produto com este SKU' }
      });
    }

    const [novo] = await sql`
      INSERT INTO produto (sku, nome, descricao, categoria, fabricante, cor, tamanho, preco_atual, estoque_atual, estoque_minimo)
      VALUES (${sku}, ${nome}, ${descricao ?? null}, ${categoria ?? null}, ${fabricante ?? null}, ${cor ?? null}, ${tamanho ?? null}, ${preco_atual}, ${estoque_atual ?? 0}, ${estoque_minimo ?? 5})
      RETURNING *
    `;

    res.status(201).json({ success: true, data: novo });
  } catch (error) {
    console.error('[ERRO POST /produtos]', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao criar produto' }
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { sku, nome, descricao, categoria, fabricante, cor, tamanho, preco_atual, estoque_atual, estoque_minimo } = req.body;

    const [produto] = await sql`SELECT * FROM produto WHERE id = ${id} AND ativo = true`;
    if (!produto) {
      return res.status(404).json({
        success: false,
        error: { code: 'NAO_ENCONTRADO', message: 'Produto não encontrado' }
      });
    }

    if (preco_atual !== undefined && preco_atual <= 0) {
      return res.status(422).json({
        success: false,
        error: { code: 'PRECO_INVALIDO', message: 'O preço deve ser maior que zero' }
      });
    }

    if (sku && sku !== produto.sku) {
      const [skuExistente] = await sql`SELECT id FROM produto WHERE sku = ${sku} AND id != ${id}`;
      if (skuExistente) {
        return res.status(409).json({
          success: false,
          error: { code: 'SKU_DUPLICADO', message: 'Já existe um produto com este SKU' }
        });
      }
    }

    if (preco_atual !== undefined && Number(preco_atual) !== Number(produto.preco_atual)) {
      await sql`
        INSERT INTO historico_preco (produto_id, preco_antigo, preco_novo, alterado_em, alterado_por)
        VALUES (${id}, ${produto.preco_atual}, ${preco_atual}, NOW(), ${req.usuario.id})
      `;
    }

    const [atualizado] = await sql`
      UPDATE produto SET
        sku            = ${sku            ?? produto.sku},
        nome           = ${nome           ?? produto.nome},
        descricao      = ${descricao      ?? produto.descricao},
        categoria      = ${categoria      ?? produto.categoria},
        fabricante     = ${fabricante     ?? produto.fabricante},
        cor            = ${cor            ?? produto.cor},
        tamanho        = ${tamanho        ?? produto.tamanho},
        preco_atual    = ${preco_atual    ?? produto.preco_atual},
        estoque_atual  = ${estoque_atual  ?? produto.estoque_atual},
        estoque_minimo = ${estoque_minimo ?? produto.estoque_minimo},
        atualizado_em  = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    res.json({ success: true, data: atualizado });
  } catch (error) {
    console.error('[ERRO PUT /produtos/:id]', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao atualizar produto' }
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [produto] = await sql`
      SELECT * FROM produto WHERE id = ${req.params.id} AND ativo = true
    `;

    if (!produto) {
      return res.status(404).json({
        success: false,
        error: { code: 'NAO_ENCONTRADO', message: 'Produto não encontrado' }
      });
    }

    await sql`UPDATE produto SET ativo = false WHERE id = ${req.params.id}`;

    res.json({ success: true, message: 'Produto removido com sucesso' });
  } catch (error) {
    console.error('[ERRO DELETE /produtos/:id]', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao remover produto' }
    });
  }
});

export default router;
