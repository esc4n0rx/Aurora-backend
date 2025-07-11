const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Importar middlewares
const errorHandler = require('./middlewares/error-handler');

// Importar rotas
const authRoutes = require('./routes/auth-routes');
const profileRoutes = require('./routes/profile-routes');

const app = express();

// Middlewares de segurança
app.use(helmet());
app.use(cors());

// Servir arquivos estáticos (imagens padrão)
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Middleware de logging
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Middleware para parsing de JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rota de health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Aurora+ API está funcionando',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
    });
});

// Rota raiz
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Bem-vindo à API Aurora+',
        documentation: {
            health: 'GET /health',
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
                authenticate: 'POST /api/v1/profiles/authenticate'
            }
        }
    });
});

// Rotas da API
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profiles', profileRoutes);

// Middleware de tratamento de rotas não encontradas
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Rota ${req.method} ${req.originalUrl} não encontrada`,
        suggestion: 'Verifique a documentação da API'
    });
});

// Middleware global de tratamento de erros
app.use(errorHandler);

module.exports = app;