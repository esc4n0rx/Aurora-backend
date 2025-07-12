const { z } = require('zod');
const { isValidIP } = require('../utils/validation-utils');

// Validação para listagem de usuários
const listUsersValidation = z.object({
    limit: z.string()
        .optional()
        .default('20')
        .transform(val => parseInt(val, 10))
        .refine(val => !isNaN(val) && val >= 1 && val <= 100, {
            message: 'Limit deve ser um número entre 1 e 100'
        }),
    
    offset: z.string()
        .optional()
        .default('0')
        .transform(val => parseInt(val, 10))
        .refine(val => !isNaN(val) && val >= 0, {
            message: 'Offset deve ser um número maior ou igual a 0'
        }),
    
    search: z.string()
        .max(255, 'Busca deve ter no máximo 255 caracteres')
        .optional(),
    
    status: z.enum(['all', 'active', 'blocked', 'deleted'])
        .optional()
        .default('all'),
    
    sort_by: z.enum(['nome', 'email', 'created_at', 'last_activity'])
        .optional()
        .default('created_at'),
    
    sort_order: z.enum(['asc', 'desc'])
        .optional()
        .default('desc')
});

// Validação para bloqueio de usuário
const blockUserValidation = z.object({
    reason: z.string()
        .min(10, 'Motivo deve ter pelo menos 10 caracteres')
        .max(500, 'Motivo deve ter no máximo 500 caracteres')
});

// Validação para filtros de logs
const logsFiltersValidation = z.object({
    limit: z.string()
        .optional()
        .default('50')
        .transform(val => parseInt(val, 10))
        .refine(val => !isNaN(val) && val >= 1 && val <= 200, {
            message: 'Limit deve ser um número entre 1 e 200'
        }),
    
    offset: z.string()
        .optional()
        .default('0')
        .transform(val => parseInt(val, 10))
        .refine(val => !isNaN(val) && val >= 0, {
            message: 'Offset deve ser um número maior ou igual a 0'
        }),
    
    userId: z.string()
        .uuid('ID do usuário deve ser um UUID válido')
        .optional(),
    
    actionCategory: z.string()
        .max(50, 'Categoria deve ter no máximo 50 caracteres')
        .optional(),
    
    actionType: z.string()
        .max(100, 'Tipo de ação deve ter no máximo 100 caracteres')
        .optional(),
    
    startDate: z.string()
        .datetime('Data de início deve ser uma data válida no formato ISO')
        .optional(),
    
    endDate: z.string()
        .datetime('Data de fim deve ser uma data válida no formato ISO')
        .optional(),
    
    ipAddress: z.string()
        .refine(isValidIP, {
            message: 'Endereço IP inválido'
        })
        .optional(),
    
    statusCode: z.string()
        .optional()
        .transform(val => val ? parseInt(val, 10) : undefined)
        .refine(val => val === undefined || (!isNaN(val) && val >= 100 && val <= 599), {
            message: 'Status code deve ser um número entre 100 e 599'
        })
});

// Validação para estatísticas de logs
const logsStatsValidation = z.object({
    timeRange: z.enum(['1d', '7d', '30d', '90d'])
        .optional()
        .default('7d')
});

module.exports = {
    listUsersValidation,
    blockUserValidation,
    logsFiltersValidation,
    logsStatsValidation
};