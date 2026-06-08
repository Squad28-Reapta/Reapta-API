import jwt from 'jsonwebtoken';


export const autenticar = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: { code: 'TOKEN_AUSENTE', message: 'Token não fornecido' }
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: { code: 'TOKEN_INVALIDO', message: 'Token inválido ou expirado'}
        });
    }
}