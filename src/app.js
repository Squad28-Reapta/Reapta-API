import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { autenticar } from './middlewares/auth.js';

import produtosRouter from './routes/produtos.js';
import usuariosRouter from './routes/usuarios.js';
import authRouter from './routes/auth.js';
import vendasRouter from './routes/vendas.js';
import relatoriosRouter from './routes/relatorios.js';
import aiRouter from "./routes/ai.js";

const app = express();

app.use(cors({
  origin: 'http://localhost:5173'
}));

app.use(express.json());

app.use("/api/v1/ai", aiRouter);


app.use('/api/v1/auth', authRouter);
app.use('/api/v1/produtos', autenticar, produtosRouter);
app.use('/api/v1/usuarios', autenticar, usuariosRouter);
app.use('/api/v1/vendas', autenticar, vendasRouter);
app.use('/api/v1/relatorios', autenticar, relatoriosRouter);

// eslint-disable-next-line no-unused-vars 
app.use((err, req, res, next) => {
  console.error('[ERRO GLOBAL]', err);
  res.status(500).json({
    success: false,
    error: { code: 'ERRO_INTERNO', message: 'Erro interno do servidor' }
  });
});

app.listen(8000, () => console.log('Servidor rodando na porta 8000'));
