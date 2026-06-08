import express from 'express';
import sql from '../db.js';
import { sendEmail } from '../services/mail.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

const codigos = {};

router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({
        success: false,
        error: { code: 'CAMPOS_OBRIGATORIOS', message: 'email e senha são obrigatórios' }
      });
    }

    const [usuario] = await sql`SELECT * FROM usuario WHERE email = ${email} AND senha_hash = ${senha}`;

    if (!usuario) {
      return res.status(401).json({
        success: false,
        error: { code: 'CREDENCIAIS_INVALIDAS', message: 'Email ou senha inválidos' }
      });
    }

    if (usuario.ativo === false) {
      return res.status(403).json({
        success: false,
        error: { code: 'USUARIO_INATIVO', message: 'Usuário inativo. Contate o administrador.' }
      });
    }
    
    const token = jwt.sign({ id: usuario.id, email: usuario.email, perfil: usuario.perfil },
      process.env.JWT_SECRET,
      {expiresIn: '8h'});


    res.json({ success: true, data: { token, usuario } });
  } catch (error) {
    console.error('[ERRO POST /auth/login]', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao fazer login' }
    });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    const [usuario] = await sql`SELECT * FROM usuario WHERE email = ${email}`;

    if (!usuario) {
      return res.status(404).json({
        success: false,
        error: { code: 'NAO_ENCONTRADO', message: 'Email não encontrado' }
      });
    }

    const codigoRecuperacao = Math.floor(100000 + Math.random() * 900000).toString();

    codigos[email] = {
      codigo: codigoRecuperacao,
      expira: Date.now() + 15 * 60 * 1000 // 15 minutos
    };

    await sendEmail(email, codigoRecuperacao);

    res.json({ success: true, message: 'Código de recuperação enviado para o email' });

  } catch (error) {
    console.error('[ERRO POST /auth/forgot-password]', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao processar solicitação' }
    });
  }
})

router.post('/verify-code', async (req, res) => {
  try {
    const { email, codigo } = req.body;
    const registro = codigos[email];

    if (!registro) {
      return res.status(400).json({
        success: false,
        error: { code: 'CODIGO_INVALIDO', message: 'Código não encontrado' }
      });
    }

    if (Date.now() > registro.expira) {
      delete codigos[email];
      return res.status(400).json({
        success: false,
        error: { code: 'CODIGO_EXPIRADO', message: 'Código expirado' }
      });
    }

    if (registro.codigo !== codigo) {
      return res.status(400).json({
        success: false,
        error: { code: 'CODIGO_INVALIDO', message: 'Código inválido' }
      });
    }

    delete codigos[email];
    const resetToken = `${email}-${Date.now()}`;
    codigos[`reset-${email}`] = {
      resetToken,
      expira: Date.now() + 15 * 60 * 1000
    };

    res.json({ success: true, data: { resetToken } });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao processar solicitação' }
    });
  }
})


router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    const email = resetToken.split('-')[0];
    const registro = codigos[`reset-${email}`];

    if (!registro) {
      return res.status(400).json({
        success: false,
        error: { code: 'TOKEN_INVALIDO', message: 'Token de redefinição inválido' }
      });
    }

    if (Date.now() > registro.expira) {
      delete codigos[`reset-${email}`];
      return res.status(400).json({
        success: false,
        error: { code: 'TOKEN_EXPIRADO', message: 'Token de redefinição expirado' }
      });
    }

    await sql`UPDATE usuario SET senha_hash = ${newPassword} WHERE email = ${email}`;

    delete codigos[`reset-${email}`];
    res.json({ success: true, message: 'Senha redefinida com sucesso' });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'ERRO_SERVIDOR', message: 'Erro ao processar solicitação' }
    });
  }
});

export default router;