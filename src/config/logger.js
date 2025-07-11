const winston = require('winston');
const path = require('path');

// Definir formato personalizado para logs
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
);

// Configuração dos transportes
const transports = [
    // Console (sempre ativo)
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    })
];

// Adicionar transporte de arquivo apenas em produção ou quando especificado
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGS === 'true') {
    // Log geral
    transports.push(
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/app.log'),
            level: 'info',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: logFormat
        })
    );
    
    // Log de erros
    transports.push(
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: logFormat
        })
    );
    
    // Log de ações de usuários
    transports.push(
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/user-actions.log'),
            level: 'info',
            maxsize: 10485760, // 10MB
            maxFiles: 10,
            format: logFormat
        })
    );
}

// Criar logger principal
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports,
    // Não sair em caso de erro
    exitOnError: false
});

// Logger específico para ações de usuários
const userActionLogger = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    return `${timestamp} [${level}] USER_ACTION: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
                })
            )
        }),
        ...(process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGS === 'true' ? [
            new winston.transports.File({
                filename: path.join(__dirname, '../../logs/user-actions.log'),
                maxsize: 10485760, // 10MB
                maxFiles: 10
            })
        ] : [])
    ]
});

module.exports = {
    logger,
    userActionLogger
};