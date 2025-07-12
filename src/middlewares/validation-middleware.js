/**
 * Middleware para validação de dados usando Zod
 */
const validateData = (schema) => {
    return (req, res, next) => {
        // Declarar variável fora do try-catch para evitar erro de escopo
        let dataToValidate;
        
        try {
            // Determinar dados a serem validados com base no método HTTP
            if (req.method === 'GET') {
                // Para GET, validar query parameters
                dataToValidate = req.query || {};
            } else {
                // Para POST, PUT, PATCH, validar body
                dataToValidate = req.body || {};
            }

            // Log dos dados recebidos para debugging (apenas em desenvolvimento)
            if (process.env.NODE_ENV === 'development') {
                console.log('Validation middleware - Data received:', {
                    method: req.method,
                    url: req.originalUrl,
                    dataToValidate,
                    schemaType: typeof schema
                });
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
            // Log detalhado do erro para debugging
            console.error('Validation error details:', {
                originalData: dataToValidate || 'undefined',
                method: req.method,
                url: req.originalUrl,
                errorName: error?.name,
                errorMessage: error?.message
            });

            if (error.name === 'ZodError') {
                // Verificar se errors existe antes de usar map
                const errors = error.errors && Array.isArray(error.errors) ? 
                    error.errors.map(err => ({
                        field: Array.isArray(err.path) ? err.path.join('.') : 'unknown',
                        message: err.message || 'Erro de validação',
                        code: err.code,
                        received: err.received
                    })) : [{
                        field: 'unknown',
                        message: 'Erro de validação desconhecido'
                    }];

                return res.status(400).json({
                    success: false,
                    message: 'Dados inválidos',
                    errors: errors,
                    ...(process.env.NODE_ENV === 'development' && {
                        debug: {
                            originalData: dataToValidate || {},
                            zodErrors: error.errors || [],
                            method: req.method,
                            url: req.originalUrl
                        }
                    })
                });
            }

            // Para outros tipos de erro, passar para o próximo middleware
            console.error('Non-Zod validation error:', {
                error: error.message,
                stack: error.stack,
                originalData: dataToValidate || {}
            });
            
            next(error);
        }
    };
};

module.exports = {
    validateData
};