import express from 'express';
import sql from '../db.js';
import { cpf, cnpj } from 'cpf-cnpj-validator';


// função auxiliar para validar CPF ou CNPJ
function validarCpfCnpj(valor) {
    const limpo = valor.replace(/\D/g, '');
    if (limpo.length === 11) return cpf.isValid(limpo);
    if (limpo.length === 14) return cnpj.isValid(limpo);
    return false;
}

const router = express.Router();

// GET — buscar todos os clientes ou filtrar por nome/CPF
router.get('/', async (req, res) => {
  try {
    const { busca } = req.query;

    const clientes = busca
      ? await sql`
          SELECT * FROM clientes
          WHERE nome ILIKE ${'%' + busca + '%'}
             OR cpf_cnpj ILIKE ${'%' + busca + '%'}
          ORDER BY criado_em DESC
        `
      : await sql`SELECT * FROM clientes ORDER BY criado_em DESC`;

    res.json({ success: true, data: clientes });
  } catch (error) {
    console.error('ERRO GET clientes:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao buscar clientes' }
    });
  }
});

// GET — buscar cliente por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [cliente] = await sql`SELECT * FROM clientes WHERE id = ${id}`;

    if (!cliente) {
      return res.status(404).json({
        success: false,
        error: { code: 'NAO_ENCONTRADO', message: 'Cliente não encontrado' }
      });
    }

    res.json({ success: true, data: cliente });
  } catch (error) {
    console.error('ERRO GET cliente por ID:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao buscar cliente' }
    });
  }
});


// POST — criar cliente
router.post('/', async (req, res) => {
  try {
    const { nome, cpf_cnpj, endereco, telefone, email, ie, site, instagram } = req.body;

    if (!nome || !cpf_cnpj || !endereco || !telefone || !email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CAMPOS_OBRIGATORIOS',
          message: 'nome, cpf_cnpj, endereco, telefone e email são obrigatórios'
        }
      });
    }

    // verifica se email já existe
    const [emailExiste] = await sql`SELECT id FROM clientes WHERE email = ${email}`;
    if (emailExiste) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_DUPLICADO', message: 'Email já cadastrado' }
      });
    }

    // verifica se o CPF/CNPJ é válido
    if (!validarCpfCnpj(cpf_cnpj)) {
      return res.status(400).json({
        success: false,
        error: { code: 'CPF_CNPJ_INVALIDO', message: 'CPF ou CNPJ inválido' }
      });
    }

    // verifica se CPF/CNPJ já existe
    const [cpfCnpjExiste] = await sql`SELECT id FROM clientes WHERE cpf_cnpj = ${cpf_cnpj}`;
    if (cpfCnpjExiste) {
      return res.status(409).json({
        success: false,
        error: { code: 'CPF_CNPJ_DUPLICADO', message: 'CPF/CNPJ já cadastrado' }
      });
    }


    const [cliente] = await sql`
      INSERT INTO clientes (nome, cpf_cnpj, endereco, telefone, email, ie, site, instagram)
      VALUES (${nome}, ${cpf_cnpj}, ${endereco}, ${telefone}, ${email}, ${ie ?? null}, ${site ?? null}, ${instagram ?? null})
      RETURNING *
    `;

    res.status(201).json({ success: true, data: cliente });
  } catch (error) {
    console.error('ERRO POST cliente:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao criar cliente' }
    });
  }
});

// PUT — atualizar cliente completo
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, cpf_cnpj, endereco, telefone, email, ie, site, instagram } = req.body;

    if (!nome || !cpf_cnpj || !endereco || !telefone || !email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CAMPOS_OBRIGATORIOS',
          message: 'nome, cpf_cnpj, endereco, telefone e email são obrigatórios'
        }
      });
    }

    // verifica se cliente existe
    const [existe] = await sql`SELECT id FROM clientes WHERE id = ${id}`;
    if (!existe) {
      return res.status(404).json({
        success: false,
        error: { code: 'NAO_ENCONTRADO', message: 'Cliente não encontrado' }
      });
    }

    // verifica se email já pertence a outro cliente
    const [emailExiste] = await sql`SELECT id FROM clientes WHERE email = ${email} AND id != ${id}`;
    if (emailExiste) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_DUPLICADO', message: 'Email já cadastrado' }
      });
    }

    // verifica se o CPF/CNPJ é válido
    if (!validarCpfCnpj(cpf_cnpj)) {
      return res.status(400).json({
        success: false,
        error: { code: 'CPF_CNPJ_INVALIDO', message: 'CPF ou CNPJ inválido' }
      });
    }

    // verifica se CPF/CNPJ já pertence a outro cliente
    const [cpfCnpjExiste] = await sql`SELECT id FROM clientes WHERE cpf_cnpj = ${cpf_cnpj} AND id != ${id}`;
    if (cpfCnpjExiste) {
      return res.status(409).json({
        success: false,
        error: { code: 'CPF_CNPJ_DUPLICADO', message: 'CPF/CNPJ já cadastrado' }
      });
    }

    const [cliente] = await sql`
      UPDATE clientes
      SET
        nome          = ${nome},
        cpf_cnpj      = ${cpf_cnpj},
        endereco      = ${endereco},
        telefone      = ${telefone},
        email         = ${email},
        ie            = ${ie ?? null},
        site          = ${site ?? null},
        instagram     = ${instagram ?? null},
        atualizado_em = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    res.json({ success: true, data: cliente });
  } catch (error) {
    console.error('ERRO PUT cliente:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao atualizar cliente' }
    });
  }
});

// DELETE — remover cliente permanentemente
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [existe] = await sql`SELECT id FROM clientes WHERE id = ${id}`;
    if (!existe) {
      return res.status(404).json({
        success: false,
        error: { code: 'NAO_ENCONTRADO', message: 'Cliente não encontrado' }
      });
    }

    await sql`DELETE FROM clientes WHERE id = ${id}`;

    res.json({ success: true, mensagem: 'Cliente removido com sucesso' });
  } catch (error) {
    console.error('ERRO DELETE cliente:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao deletar cliente' }
    });
  }
});

export default router;