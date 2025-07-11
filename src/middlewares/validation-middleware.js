/**
 * Middleware para validação de dados usando Zod
 */
const validateData = (schema) => {
    return (req, res, next) => {
        try {
            // Valida os dados do corpo da requisição
            const validatedData = schema.parse(req.body);
            req.body = validatedData;
            next();
        } catch (error) {
            if (error.name === 'ZodError') {
                return res.status(400).json({
                    success: false,
                    message: 'Dados inválidos',
                    errors: error.errors.map(err => ({
                        field: err.path.join('.'),
                        message: err.message
                    }))
                });
            }
            next(error);
        }
    };
};

module.exports = {
    validateData
};