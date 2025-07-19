const { z } = require('zod');
const ProxyUtils = require('../utils/proxy-utils');

// Validação para criação de proxy
const createProxyValidation = z.object({
    // Parâmetros opcionais para configurar o proxy
   quality: z.enum(['240p', '360p', '480p', '720p', '1080p', '1440p', '4k', 'auto'])
   .optional()
   .default('auto'),

maxBitrate: z.number()
   .int('Bitrate máximo deve ser um número inteiro')
   .min(100, 'Bitrate mínimo é 100 kbps')
   .max(50000, 'Bitrate máximo é 50000 kbps')
   .optional(),

forceReload: z.boolean()
   .optional()
   .default(false),

clientType: z.enum(['browser', 'mobile', 'desktop_player', 'smart_tv'])
   .optional()
   .default('browser')
});

// Validação para teste de URL
const testUrlValidation = z.object({
url: z.string()
   .min(1, 'URL é obrigatória')
   .max(2000, 'URL deve ter no máximo 2000 caracteres')
   .refine(url => ProxyUtils.isValidStreamingUrl(url), {
       message: 'URL deve ser um protocolo de streaming válido (http/https) com extensão de vídeo (.m3u8, .ts, .mp4, etc.)'
   }),

timeout: z.number()
   .int('Timeout deve ser um número inteiro')
   .min(1000, 'Timeout mínimo é 1000ms')
   .max(30000, 'Timeout máximo é 30000ms')
   .optional()
   .default(10000),

followRedirects: z.boolean()
   .optional()
   .default(true),

checkContent: z.boolean()
   .optional()
   .default(false)
});

// Validação para limpeza de cache
const clearCacheValidation = z.object({
contentId: z.string()
   .uuid('Content ID deve ser um UUID válido')
   .optional(),

cacheType: z.enum(['all', 'playlists', 'segments', 'urls'])
   .optional()
   .default('all'),

olderThan: z.number()
   .int('Idade deve ser em minutos')
   .min(1, 'Mínimo 1 minuto')
   .max(10080, 'Máximo 7 dias (10080 minutos)')
   .optional()
});

// Validação para filtros de proxy (query parameters)
const proxyFiltersValidation = z.object({
contentId: z.string()
   .uuid('Content ID deve ser um UUID válido')
   .optional(),

status: z.enum(['active', 'expired', 'all'])
   .optional()
   .default('active'),

contentType: z.enum(['playlist', 'segment', 'video/mp4', 'video/x-matroska', 'all'])
   .optional()
   .default('all'),

createdAfter: z.string()
   .datetime('Data deve estar no formato ISO')
   .optional(),

createdBefore: z.string()
   .datetime('Data deve estar no formato ISO')
   .optional(),

limit: z.string()
   .transform(val => parseInt(val, 10))
   .refine(val => !isNaN(val) && val >= 1 && val <= 100, {
       message: 'Limit deve ser um número entre 1 e 100'
   })
   .optional()
   .default('20'),

offset: z.string()
   .transform(val => parseInt(val, 10))
   .refine(val => !isNaN(val) && val >= 0, {
       message: 'Offset deve ser um número maior ou igual a 0'
   })
   .optional()
   .default('0')
});

// Validação para configuração de proxy
const proxyConfigValidation = z.object({
maxConnections: z.number()
   .int('Máximo de conexões deve ser um número inteiro')
   .min(1, 'Mínimo 1 conexão')
   .max(1000, 'Máximo 1000 conexões')
   .optional(),

requestTimeout: z.number()
   .int('Timeout deve ser um número inteiro')
   .min(5000, 'Timeout mínimo é 5000ms')
   .max(300000, 'Timeout máximo é 300000ms (5 minutos)')
   .optional(),

cacheSettings: z.object({
   playlistTTL: z.number().int().min(60).max(3600).optional(),
   segmentTTL: z.number().int().min(300).max(7200).optional(),
   urlTTL: z.number().int().min(600).max(86400).optional()
}).optional(),

rateLimiting: z.object({
   maxRequestsPerMinute: z.number().int().min(1).max(1000).optional(),
   maxRequestsPerHour: z.number().int().min(60).max(10000).optional()
}).optional()
});

module.exports = {
createProxyValidation,
testUrlValidation,
clearCacheValidation,
proxyFiltersValidation,
proxyConfigValidation
};