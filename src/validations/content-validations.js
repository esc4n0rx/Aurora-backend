const { z } = require('zod');
const ContentUtils = require('../utils/content-utils');

// Validação para criação de conteúdo
const createContentValidation = z.object({
    nome: z.string()
        .min(1, 'Nome é obrigatório')
        .max(255, 'Nome deve ter no máximo 255 caracteres'),
    
    url_transmissao: z.string()
        .url('URL de transmissão deve ser válida')
        .max(500, 'URL deve ter no máximo 500 caracteres')
        .refine(url => ContentUtils.isValidStreamingUrl(url), {
            message: 'URL deve ser um protocolo de streaming válido (http, https, rtmp, rtmps)'
        }),
    
    poster: z.string()
        .url('URL do poster deve ser válida')
        .max(500, 'URL do poster deve ter no máximo 500 caracteres')
        .optional(),
    
    categoria: z.string()
        .refine(cat => ContentUtils.isValidCategory(cat), {
            message: `Categoria deve ser uma das seguintes: ${ContentUtils.CATEGORIES.join(', ')}`
        }),
    
    subcategoria: z.string()
        .refine(subcat => ContentUtils.isValidSubcategory(subcat), {
            message: `Subcategoria deve ser uma das seguintes: ${ContentUtils.SUBCATEGORIES.join(', ')}`
        }),
    
    ativo: z.boolean().optional().default(true),
    
    temporada: z.number()
        .int('Temporada deve ser um número inteiro')
        .min(1, 'Temporada deve ser maior que 0')
        .optional(),
    
    episodio: z.number()
        .int('Episódio deve ser um número inteiro')
        .min(1, 'Episódio deve ser maior que 0')
        .optional(),
    
    rating: z.number()
        .min(0, 'Rating deve ser entre 0 e 10')
        .max(10, 'Rating deve ser entre 0 e 10')
        .optional()
        .default(0),
    
    qualidades: z.array(z.string())
        .refine(qualities => ContentUtils.validateQualities(qualities), {
            message: `Qualidades devem ser: ${ContentUtils.QUALITIES.join(', ')}`
        })
        .optional()
        .default(['auto']),
    
    metadata: z.record(z.any()).optional().default({})
})
.refine(data => {
    // Se for série, temporada e episódio são obrigatórios
    if (ContentUtils.isSeries(data.subcategoria)) {
        return data.temporada && data.episodio;
    }
    return true;
}, {
    message: 'Temporada e episódio são obrigatórios para séries, animes e minisséries',
    path: ['temporada']
});

// Validação para atualização de conteúdo
const updateContentValidation = z.object({
    nome: z.string()
        .min(1, 'Nome é obrigatório')
        .max(255, 'Nome deve ter no máximo 255 caracteres')
        .optional(),
    
    url_transmissao: z.string()
        .url('URL de transmissão deve ser válida')
        .max(500, 'URL deve ter no máximo 500 caracteres')
        .refine(url => ContentUtils.isValidStreamingUrl(url), {
            message: 'URL deve ser um protocolo de streaming válido'
        })
        .optional(),
    
    poster: z.string()
        .url('URL do poster deve ser válida')
        .max(500, 'URL do poster deve ter no máximo 500 caracteres')
        .optional(),
    
    categoria: z.string()
        .refine(cat => ContentUtils.isValidCategory(cat))
        .optional(),
    
    subcategoria: z.string()
        .refine(subcat => ContentUtils.isValidSubcategory(subcat))
        .optional(),
    
    ativo: z.boolean().optional(),
    
    temporada: z.number()
        .int('Temporada deve ser um número inteiro')
        .min(1, 'Temporada deve ser maior que 0')
        .optional(),
    
    episodio: z.number()
        .int('Episódio deve ser um número inteiro')
        .min(1, 'Episódio deve ser maior que 0')
        .optional(),
    
    rating: z.number()
        .min(0, 'Rating deve ser entre 0 e 10')
        .max(10, 'Rating deve ser entre 0 e 10')
        .optional(),
    
    qualidades: z.array(z.string())
        .refine(qualities => ContentUtils.validateQualities(qualities))
        .optional(),
    
    metadata: z.record(z.any()).optional()
});

// Validação para filtros de listagem (query parameters)
const listContentValidation = z.object({
    categoria: z.string().optional(),
    subcategoria: z.string().optional(),
    ativo: z.string()
        .transform(val => val === 'true')
        .optional(),
    rating_min: z.string()
        .transform(val => parseFloat(val))
        .refine(val => !isNaN(val) && val >= 0 && val <= 10, 'Rating mínimo deve ser entre 0 e 10')
        .optional(),
    rating_max: z.string()
        .transform(val => parseFloat(val))
        .refine(val => !isNaN(val) && val >= 0 && val <= 10, 'Rating máximo deve ser entre 0 e 10')
        .optional(),
    temporada: z.string()
        .transform(val => parseInt(val))
        .refine(val => !isNaN(val) && val >= 1, 'Temporada deve ser um número maior que 0')
        .optional(),
    limit: z.string()
        .transform(val => parseInt(val))
        .refine(val => !isNaN(val) && val >= 1 && val <= 100, 'Limit deve ser entre 1 e 100')
        .optional()
        .default('20'),
    offset: z.string()
        .transform(val => parseInt(val))
        .refine(val => !isNaN(val) && val >= 0, 'Offset deve ser maior ou igual a 0')
        .optional()
        .default('0'),
    search: z.string().max(255).optional(),
    sort_by: z.enum(['nome', 'rating', 'total_visualizations', 'created_at']).optional().default('created_at'),
    sort_order: z.enum(['asc', 'desc']).optional().default('desc')
});

// Validação para registro de visualização
const recordViewValidation = z.object({
    user_id: z.string().uuid().optional(),
    profile_id: z.string().uuid().optional(),
    view_duration: z.number().int().min(0).optional(),
    view_percentage: z.number().min(0).max(100).optional()
});

module.exports = {
    createContentValidation,
    updateContentValidation,
    listContentValidation,
    recordViewValidation
};