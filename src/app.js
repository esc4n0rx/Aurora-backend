const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Importar middlewares
const errorHandler = require('./middlewares/error-handler');
const { logHealthCheck, logDocsAccess } = require('./middlewares/logging-middleware');

// Importar rotas
const authRoutes = require('./routes/auth-routes');
const profileRoutes = require('./routes/profile-routes');
const contentRoutes = require('./routes/content-routes');
const streamRoutes = require('./routes/stream-routes'); // Nova rota
const adminRoutes = require('./routes/admin-routes');
const healthRoutes = require('./routes/health-routes');

// Importar logger
const { logger } = require('./config/logger');

const app = express();

// Criar diretório de logs se não existir
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Middlewares de segurança (ajustados para streaming)
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Permitir recursos cross-origin para vídeo
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            mediaSrc: ["'self'", "blob:", "data:"], // Permitir streaming de mídia
            connectSrc: ["'self'", "ws:", "wss:"] // Permitir WebSockets para torrents
        }
    }
}));

app.use(cors({
    origin: true, // Permitir qualquer origem para compatibilidade com players
    credentials: true,
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length']
}));

// Configurar trust proxy para obter IP correto
app.set('trust proxy', true);

// Servir arquivos estáticos (imagens padrão)
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Middleware de logging customizado para requisições
app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';
        
        logger.info('HTTP Request', {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            responseTime: duration,
            ip: clientIP,
            userAgent: req.get('User-Agent'),
            userId: req.user?.userId || null
        });
    });
    
    next();
});

// Middleware de logging padrão do Morgan (apenas em desenvolvimento)
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Middleware para parsing de JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rota de health check básico (compatibilidade com versão anterior)
app.get('/health', logHealthCheck, (req, res) => {
    res.json({
        success: true,
        message: 'Aurora+ API está funcionando',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Rota raiz com log de documentação
app.get('/', logDocsAccess, (req, res) => {
    res.json({
        success: true,
        message: 'Bem-vindo à API Aurora+',
        documentation: {
            health: {
                basic: 'GET /health',
                detailed: 'GET /api/v1/health/full',
                readiness: 'GET /api/v1/health/ready',
                liveness: 'GET /api/v1/health/live'
            },
            auth: {
                register: 'POST /api/v1/auth/register',
                login: 'POST /api/v1/auth/login',
                checkEmail: 'POST /api/v1/auth/check-email'
            },
            profiles: {
                list: 'GET /api/v1/profiles',
                create: 'POST /api/v1/profiles',
                get: 'GET /api/v1/profiles/:profileId',
                update: 'PUT /api/v1/profiles/:profileId',
                delete: 'DELETE /api/v1/profiles/:profileId',
                updateAvatar: 'PUT /api/v1/profiles/:profileId/avatar',
                authenticate: 'POST /api/v1/profiles/authenticate',
                avatars: 'GET /api/v1/profiles/avatars'
            },
            contents: {
                list: 'GET /api/v1/contents',
                create: 'POST /api/v1/contents (Admin only)',
                get: 'GET /api/v1/contents/:contentId',
                update: 'PUT /api/v1/contents/:contentId (Admin only)',
                delete: 'DELETE /api/v1/contents/:contentId (Admin only)',
                popular: 'GET /api/v1/contents/popular',
                recordView: 'POST /api/v1/contents/:contentId/view',
                seriesEpisodes: 'GET /api/v1/contents/series/:seriesName/episodes',
                stats: 'GET /api/v1/contents/admin/stats (Admin only)',
                viewStats: 'GET /api/v1/contents/:contentId/stats (Admin only)'
            },
            streaming: {
                startStream: 'POST /api/v1/stream/content/:contentId/start',
                streamVideo: 'GET /api/v1/stream/:streamId/video',
                playContent: 'GET /api/v1/stream/content/:contentId/play',
                streamInfo: 'GET /api/v1/stream/:streamId/info',
                stopStream: 'DELETE /api/v1/stream/:streamId',
                stats: 'GET /api/v1/stream/admin/stats (Admin only)'
            },
            admin: {
                users: {
                    list: 'GET /api/v1/admin/users (Admin only)',
                    details: 'GET /api/v1/admin/users/:userId (Admin only)',
                    block: 'POST /api/v1/admin/users/:userId/block (Admin only)',
                    unblock: 'POST /api/v1/admin/users/:userId/unblock (Admin only)',
                    delete: 'DELETE /api/v1/admin/users/:userId (Admin only)',
                    restore: 'POST /api/v1/admin/users/:userId/restore (Admin only)'
                },
                logs: {
                    list: 'GET /api/v1/admin/logs (Admin only)',
                    stats: 'GET /api/v1/admin/logs/stats (Admin only)'
                },
                system: {
                    stats: 'GET /api/v1/admin/stats (Admin only)'
                }
            }
        }
    });
});

// Rotas da API
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profiles', profileRoutes);
app.use('/api/v1/contents', contentRoutes);
app.use('/api/v1/stream', streamRoutes); // Nova rota de streaming
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/health', healthRoutes);

// Middleware de tratamento de rotas não encontradas
app.use((req, res, next) => {
    logger.warn('Route not found', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    
    res.status(404).json({
        success: false,
        message: `Rota ${req.method} ${req.originalUrl} não encontrada`,
        suggestion: 'Verifique a documentação da API'
    });
});

// Middleware global de tratamento de erros
app.use((err, req, res, next) => {
    logger.error('Application error', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userId: req.user?.userId || null
    });
    
    errorHandler(err, req, res, next);
});

module.exports = app;