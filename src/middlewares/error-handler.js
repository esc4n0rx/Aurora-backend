/**
 * Middleware global para tratamento de erros
 */
const errorHandler = (err, req, res, next) => {
    console.error('Erro capturado:', err);

    // Erro de validação do Zod
    if (err.name === 'ZodError') {
        return res.status(400).json({
            success: false,
            message: 'Dados inválidos',
            errors: err.errors
        });
    }

    // Erro de JWT
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Token inválido'
        });
    }

    // Erro de token expirado
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expirado'
        });
    }

    // Erro padrão
    res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
};

module.exports = errorHandler;