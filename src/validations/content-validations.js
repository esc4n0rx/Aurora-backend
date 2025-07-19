const { z } = require('zod');
const ContentUtils = require('../utils/content-utils');

// Validação personalizada para categoria dinâmica
const dynamicCategoryValidation = z.string()
    .min(1, 'Categoria é obrigatória')
    .max(100, 'Categoria deve ter no máximo 100 caracteres')
    .regex(/^[A-ZÁÉÍÓÚÇ0-9\s+&-]+$/i, 'Categoria contém caracteres inválidos')
    .transform(val => val.toUpperCase().trim()); // Normalizar para uppercase

// Validação para criação de conteúdo
const createContentValidation = z.object({
    nome: z.string()
        .min(1, 'Nome é obrigatório')
        .max(255, 'Nome deve ter no máximo 255 caracteres'),
    
    url_transmissao: z.string()
        .url('URL de transmissão deve ser válida')
        .max(500, 'URL deve ter no máximo 500 caracteres')
        .refine(url => ContentUtils.isValidStreamingUrl(url), {
            message: 'URL deve ser um protocolo de streaming válido (http, https, rtmp, rtmps) ou magnet link'
        }),
    
    poster: z.string()
        .url('URL do poster deve ser válida')
        .max(500, 'URL do poster deve ter no máximo 500 caracteres')
        .optional(),
    
    backdrop: z.string()
        .url('URL do backdrop deve ser válida')
        .max(500, 'URL do backdrop deve ter no máximo 500 caracteres')
        .optional(),
    
    categoria: dynamicCategoryValidation,
    
    subcategoria: z.string()
        .refine(subcat => ContentUtils.isValidSubcategory(subcat), {
            message: `Subcategoria deve ser uma das seguintes: ${ContentUtils.SUBCATEGORIES.join(', ')}`
        }),
    
    ativo: z.boolean().optional().default(true),
    
    // Campos de temporada/episódio
    temporada: z.number()
        .int('Temporada deve ser um número inteiro')
        .min(1, 'Temporada deve ser maior que 0')
        .optional(),
    
    episodio: z.number()
        .int('Episódio deve ser um número inteiro')
        .min(1, 'Episódio deve ser maior que 0')
        .optional(),
    
    // Novos campos para série
    nome_episodio: z.string()
        .max(255, 'Nome do episódio deve ter no máximo 255 caracteres')
        .optional(),
    
    descricao_serie: z.string()
        .max(2000, 'Descrição da série deve ter no máximo 2000 caracteres')
        .optional(),
    
    descricao_temporada: z.string()
        .max(2000, 'Descrição da temporada deve ter no máximo 2000 caracteres')
        .optional(),
    
    descricao_episodio: z.string()
        .max(2000, 'Descrição do episódio deve ter no máximo 2000 caracteres')
        .optional(),
    
    status_serie: z.enum(['em_andamento', 'finalizada', 'cancelada', 'pausada'])
        .optional(),
    
    episodios_total: z.number()
        .int('Total de episódios deve ser um número inteiro')
        .min(1, 'Total de episódios deve ser maior que 0')
        .optional(),
    
    temporadas_total: z.number()
        .int('Total de temporadas deve ser um número inteiro')
        .min(1, 'Total de temporadas deve ser maior que 0')
        .optional(),
    
    // Campos TMDB
    tmdb_hit: z.boolean().optional().default(false),
    
    tmdb_serie_id: z.number()
        .int('ID da série no TMDB deve ser um número inteiro')
        .optional(),
    
    tmdb_temporada_id: z.number()
        .int('ID da temporada no TMDB deve ser um número inteiro')
        .optional(),
    
    tmdb_episodio_id: z.number()
        .int('ID do episódio no TMDB deve ser um número inteiro')
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
})
.refine(data => {
    // Se tem dados TMDB de temporada/episódio, deve ter série também
    if (data.tmdb_temporada_id || data.tmdb_episodio_id) {
        return data.tmdb_serie_id;
    }
    return true;
}, {
    message: 'ID da série no TMDB é obrigatório quando há IDs de temporada ou episódio',
    path: ['tmdb_serie_id']
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
            message: 'URL deve ser um protocolo de streaming válido ou magnet link'
        })
        .optional(),
    
    poster: z.string()
        .url('URL do poster deve ser válida')
        .max(500, 'URL do poster deve ter no máximo 500 caracteres')
        .optional(),
    
    backdrop: z.string()
        .url('URL do backdrop deve ser válida')
        .max(500, 'URL do backdrop deve ter no máximo 500 caracteres')
        .optional(),
    
    categoria: dynamicCategoryValidation.optional(),
    
    subcategoria: z.string()
        .refine(subcat => ContentUtils.isValidSubcategory(subcat))
        .optional(),
    
    ativo: z.boolean().optional(),
    
    // Campos de temporada/episódio
    temporada: z.number()
        .int('Temporada deve ser um número inteiro')
        .min(1, 'Temporada deve ser maior que 0')
        .optional(),
    
    episodio: z.number()
        .int('Episódio deve ser um número inteiro')
        .min(1, 'Episódio deve ser maior que 0')
        .optional(),
    
    // Novos campos para série
    nome_episodio: z.string()
        .max(255, 'Nome do episódio deve ter no máximo 255 caracteres')
        .optional(),
    
    descricao_serie: z.string()
        .max(2000, 'Descrição da série deve ter no máximo 2000 caracteres')
        .optional(),
    
    descricao_temporada: z.string()
        .max(2000, 'Descrição da temporada deve ter no máximo 2000 caracteres')
        .optional(),
    
    descricao_episodio: z.string()
        .max(2000, 'Descrição do episódio deve ter no máximo 2000 caracteres')
        .optional(),
    
    status_serie: z.enum(['em_andamento', 'finalizada', 'cancelada', 'pausada'])
        .optional(),
    
    episodios_total: z.number()
        .int('Total de episódios deve ser um número inteiro')
        .min(1, 'Total de episódios deve ser maior que 0')
        .optional(),
    
    temporadas_total: z.number()
        .int('Total de temporadas deve ser um número inteiro')
        .min(1, 'Total de temporadas deve ser maior que 0')
        .optional(),
    
    // Campos TMDB
    tmdb_hit: z.boolean().optional(),
    
    tmdb_serie_id: z.number()
        .int('ID da série no TMDB deve ser um número inteiro')
        .optional(),
    
    tmdb_temporada_id: z.number()
        .int('ID da temporada no TMDB deve ser um número inteiro')
        .optional(),
    
    tmdb_episodio_id: z.number()
        .int('ID do episódio no TMDB deve ser um número inteiro')
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

// Validação para filtros de listagem (query parameters) - atualizada
const listContentValidation = z.object({
    categoria: z.string()
        .max(100, 'Categoria deve ter no máximo 100 caracteres')
        .optional(),
    
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
    
    status_serie: z.enum(['em_andamento', 'finalizada', 'cancelada', 'pausada'])
        .optional(),
    
    tmdb_hit: z.string()
        .transform(val => val === 'true')
        .optional(),
    
    serie_nome: z.string()
        .max(255, 'Nome da série deve ter no máximo 255 caracteres')
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
    
    sort_by: z.enum(['nome', 'rating', 'total_visualizations', 'created_at', 'temporada', 'episodio'])
        .optional()
        .default('created_at'),
    
    sort_order: z.enum(['asc', 'desc']).optional().default('desc')
});

// Validação para registro de visualização
const recordViewValidation = z.object({
    user_id: z.string().uuid().optional(),
    profile_id: z.string().uuid().optional(),
    view_duration: z.number().int().min(0).optional(),
    view_percentage: z.number().min(0).max(100).optional(),
    intent: z.enum(['watch', 'rewatch']).optional().default('watch')
});

module.exports = {
    createContentValidation,
    updateContentValidation,
    listContentValidation,
    recordViewValidation
};