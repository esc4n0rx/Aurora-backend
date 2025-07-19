const { z } = require('zod');

// Validação para listagem de categorias populares
const categoriesListValidation = z.object({
    limit: z.string()
        .optional()
        .default('20')
        .transform(val => parseInt(val, 10))
        .refine(val => !isNaN(val) && val >= 1 && val <= 100, {
            message: 'Limit deve ser um número entre 1 e 100'
        })
});

// Validação para busca de categorias
const categorySearchValidation = z.object({
    q: z.string()
        .min(2, 'Termo de busca deve ter pelo menos 2 caracteres')
        .max(100, 'Termo de busca deve ter no máximo 100 caracteres'),
    
    limit: z.string()
        .optional()
        .default('10')
        .transform(val => parseInt(val, 10))
        .refine(val => !isNaN(val) && val >= 1 && val <= 50, {
            message: 'Limit deve ser um número entre 1 e 50'
        })
});

// Validação para detalhes de categoria
const categoryDetailsValidation = z.object({
    categoria: z.string()
        .min(1, 'Nome da categoria é obrigatório')
        .max(100, 'Nome da categoria deve ter no máximo 100 caracteres')
        .regex(/^[A-ZÁÉÍÓÚ0-9\s+&-]+$/i, 'Categoria contém caracteres inválidos')
});

module.exports = {
    categoriesListValidation,
    categorySearchValidation,
    categoryDetailsValidation
};