const os = require('os');
const process = require('process');
const { supabaseAdmin } = require('../config/database');

class SystemUtils {
    /**
     * Obter uso de CPU (média dos últimos segundos)
     */
    static getCPUUsage() {
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;

        cpus.forEach(cpu => {
            for (let type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });

        const idle = totalIdle / cpus.length;
        const total = totalTick / cpus.length;
        const usage = 100 - ~~(100 * idle / total);

        return {
            usage: Math.round(usage * 100) / 100,
            cores: cpus.length,
            model: cpus[0].model
        };
    }

    /**
     * Obter uso de memória
     */
    static getMemoryUsage() {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const processMemory = process.memoryUsage();

        return {
            total: Math.round(totalMemory / 1024 / 1024), // MB
            free: Math.round(freeMemory / 1024 / 1024), // MB
            used: Math.round(usedMemory / 1024 / 1024), // MB
            usage: Math.round((usedMemory / totalMemory) * 100 * 100) / 100,
            process: {
                rss: Math.round(processMemory.rss / 1024 / 1024), // MB
                heapTotal: Math.round(processMemory.heapTotal / 1024 / 1024), // MB
                heapUsed: Math.round(processMemory.heapUsed / 1024 / 1024), // MB
                external: Math.round(processMemory.external / 1024 / 1024) // MB
            }
        };
    }

    /**
     * Obter informações do sistema
     */
    static getSystemInfo() {
        return {
            platform: os.platform(),
            architecture: os.arch(),
            hostname: os.hostname(),
            uptime: Math.floor(os.uptime()),
            nodeVersion: process.version,
            processUptime: Math.floor(process.uptime()),
            environment: process.env.NODE_ENV || 'development'
        };
    }

    /**
     * Verificar conectividade com banco de dados
     */
    static async checkDatabaseHealth() {
        try {
            const start = Date.now();
            
            // Teste simples de conectividade
            const { data, error } = await supabaseAdmin
                .from('users')
                .select('count')
                .limit(1);

            const responseTime = Date.now() - start;

            if (error) {
                return {
                    status: 'unhealthy',
                    message: error.message,
                    responseTime
                };
            }

            return {
                status: 'healthy',
                message: 'Database connection successful',
                responseTime
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: error.message,
                responseTime: null
            };
        }
    }

    /**
     * Determinar status geral da aplicação
     */
    static determineOverallHealth(checks) {
        const { database, memory, disk } = checks;
        
        // Se banco está down, sistema crítico
        if (database.status === 'unhealthy') {
            return 'critical';
        }

        // Se memória muito alta, warning
        if (memory.usage > 85) {
            return 'warning';
        }

        // Se response time do banco muito alto, warning
        if (database.responseTime > 5000) {
            return 'warning';
        }

        return 'healthy';
    }

    /**
     * Obter informações do disco
     */
    static getDiskUsage() {
        try {
            const stats = require('fs').statSync('.');
            return {
                available: 'N/A', // Node.js não tem API nativa para isso
                message: 'Disk monitoring requires additional package'
            };
        } catch (error) {
            return {
                available: 'N/A',
                message: 'Unable to check disk usage'
            };
        }
    }
}

module.exports = SystemUtils;