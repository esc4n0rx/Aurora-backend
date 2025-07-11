const UserActionModel = require('../src/models/user-action-model');
const { logger } = require('../src/config/logger');

/**
 * Script para limpeza de logs antigos
 * Execute: npm run logs:clean
 */
async function cleanOldLogs() {
    try {
        console.log('Iniciando limpeza de logs antigos...');
        
        // Remover ações com mais de 90 dias
        const result = await UserActionModel.deleteOldActions(90);
        
        logger.info('Old logs cleanup completed', {
            deletedRecords: result?.length || 0,
            cutoffDays: 90
        });
        
        console.log(`✅ Limpeza concluída. ${result?.length || 0} registros removidos.`);
        process.exit(0);
        
    } catch (error) {
        logger.error('Failed to clean old logs', {
            error: error.message,
            stack: error.stack
        });
        
        console.error('❌ Erro na limpeza:', error.message);
        process.exit(1);
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    cleanOldLogs();
}

module.exports = cleanOldLogs;