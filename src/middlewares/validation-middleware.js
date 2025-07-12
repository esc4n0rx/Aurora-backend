/**
 * Middleware para validação de dados usando Zod
 */
const validateData = (schema) => {
    return (req, res, next) => {
        try {
            // Determinar dados a serem validados com base no método HTTP
            let dataToValidate;
            
            if (req.method === 'GET') {
                // Para GET, validar query parameters
                dataToValidate = req.query;
            } else {
                // Para POST, PUT, PATCH, validar body
                dataToValidate = req.body;
            }

            // Valida os dados
            const validatedData = schema.parse(dataToValidate);
            
            // Atualizar req com dados validados
            if (req.method === 'GET') {
                req.query = validatedData;
            } else {
                req.body = validatedData;
            }
            
            next();
        } catch (error) {
            if (error.name === 'ZodError') {
                // Verificar se errors existe antes de usar map
                const errors = error.errors ? error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message,
                    code: err.code,
                    received: err.received
                })) : [{
                    field: 'unknown',
                    message: 'Erro de validação'
                }];

                // Log detalhado do erro de validação
                console.error('Validation error details:', {
                    originalData: dataToValidate,
                    errors: error.errors,
                    method: req.method,
                    url: req.originalUrl
                });

                return res.status(400).json({
                    success: false,
                    message: 'Dados inválidos',
                    errors: errors,
                    ...(process.env.NODE_ENV === 'development' && {
                        debug: {
                            originalData: dataToValidate,
                            zodErrors: error.errors
                        }
                    })
                });
            }
            next(error);
        }
    };
};

module.exports = {
    validateData
};