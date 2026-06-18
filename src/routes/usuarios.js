import express from 'express';
import bcrypt from 'bcrypt';
import sql from '../db.js';

const router = express.Router();

// GET — buscar todos os usuários
router.get('/', async (req, res) => {
  try {
    const usuarios = await sql`SELECT id, nome, email, perfil, ativo, criado_em FROM usuario`;
    res.json({ success: true, data: usuarios });
  } catch (error) {
    console.error('ERRO GET usuarios:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao buscar usuários' }
    });
  }
});

// GET — buscar usuário por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [usuario] = await sql`SELECT id, nome, email, perfil, ativo, criado_em FROM usuario WHERE id = ${id}`;

    if (!usuario) {
      return res.status(404).json({
        success: false,
        error: { code: 'NAO_ENCONTRADO', message: 'Usuário não encontrado' }
      });
    }

    res.json({ success: true, data: usuario });
  } catch (error) {
    console.error('ERRO GET usuario/:id:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao buscar usuário' }
    });
  }
});

// POST — criar usuário
router.post('/', async (req, res) => {
  try {
    const { nome, email, senha, perfil } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({
        success: false,
        error: { code: 'CAMPOS_OBRIGATORIOS', message: 'nome, email e senha são obrigatórios' }
      });
    }

    const [emailExiste] = await sql`SELECT id, ativo FROM usuario WHERE email = ${email}`;
    if (emailExiste && emailExiste.ativo === true) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_DUPLICADO', message: 'Email já cadastrado' }
      });
    }

    // ✅ Hash da senha antes de salvar
    const senhaHash = await bcrypt.hash(senha, 10);

    const [usuario] = await sql`
      INSERT INTO usuario (nome, email, senha_hash, perfil)
      VALUES (${nome}, ${email}, ${senhaHash}, ${perfil ?? 'funcionario'})
      RETURNING id, nome, email, perfil, ativo, criado_em
    `;

    res.status(201).json({ success: true, data: usuario });
  } catch (error) {
    console.error('ERRO POST usuario:', error); // ✅ log adicionado
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao criar usuário' }
    });
  }
});

// PUT — atualizar usuário
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, perfil } = req.body;

    if (!nome || !email) {
      return res.status(400).json({
        success: false,
        error: { code: 'CAMPOS_OBRIGATORIOS', message: 'nome e email são obrigatórios' }
      });
    }

    const [existe] = await sql`SELECT id FROM usuario WHERE id = ${id}`;
    if (!existe) {
      return res.status(404).json({
        success: false,
        error: { code: 'NAO_ENCONTRADO', message: 'Usuário não encontrado' }
      });
    }

    const [emailExiste] = await sql`SELECT id FROM usuario WHERE email = ${email} AND id != ${id}`;
    if (emailExiste) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_DUPLICADO', message: 'Email já cadastrado' }
      });
    }

    const [usuario] = await sql`
      UPDATE usuario
      SET nome = ${nome}, email = ${email}, perfil = ${perfil ?? 'funcionario'}
      WHERE id = ${id}
      RETURNING id, nome, email, perfil, ativo, criado_em
    `;

    res.json({ success: true, data: usuario });
  } catch (error) {
    console.error('ERRO PUT usuario/:id:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao atualizar usuário' }
    });
  }
});

// DELETE — soft delete
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [existe] = await sql`SELECT id FROM usuario WHERE id = ${id}`;
    if (!existe) {
      return res.status(404).json({
        success: false,
        error: { code: 'NAO_ENCONTRADO', message: 'Usuário não encontrado' }
      });
    }

    await sql`UPDATE usuario SET ativo = false WHERE id = ${id}`;

    res.json({ success: true, mensagem: 'Usuário desativado com sucesso' });
  } catch (error) {
    console.error('ERRO DELETE usuario/:id:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao deletar usuário' }
    });
  }
});

export default router;