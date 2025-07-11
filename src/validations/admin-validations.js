const { z } = require('zod');

// Validação para listagem de usuários
const listUsersValidation = z.object({
    limit: z.number().int().min(1).max(100).optional().default(20),
    offset: z.number().int().min(0).optional().default(0),
    search: z.string().max(255).optional(),
    status: z.enum(['all', 'active', 'blocked', 'deleted']).optional().default('all'),
    sort_by: z.enum(['nome', 'email', 'created_at', 'last_activity']).optional().default('created_at'),
    sort_order: z.enum(['asc', 'desc']).optional().default('desc')
});

// Validação para bloqueio de usuário
const blockUserValidation = z.object({
    reason: z.string()
        .min(10, 'Motivo deve ter pelo menos 10 caracteres')
        .max(500, 'Motivo deve ter no máximo 500 caracteres')
});

// Validação para filtros de logs
const logsFiltersValidation = z.object({
    limit: z.number().int().min(1).max(200).optional().default(50),
    offset: z.number().int().min(0).optional().default(0),
    userId: z.string().uuid().optional(),
    actionCategory: z.string().max(50).optional(),
    actionType: z.string().max(100).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    ipAddress: z.string().ip().optional(),
    statusCode: z.number().int().min(100).max(599).optional()
});

// Validação para estatísticas de logs
const logsStatsValidation = z.object({
    timeRange: z.enum(['1d', '7d', '30d', '90d']).optional().default('7d')
});

module.exports = {
    listUsersValidation,
    blockUserValidation,
    logsFiltersValidation,
    logsStatsValidation
};