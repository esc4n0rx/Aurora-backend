const EventEmitter = require('events');
const { logger } = require('../config/logger');

class StreamPoolService extends EventEmitter {
    constructor() {
        super();
        this.activeStreams = new Map(); // streamId -> { connections, lastActivity }
        this.connectionTimeouts = new Map(); // connectionId -> timeout
        this.maxConnectionsPerStream = 10;
        this.connectionTimeout = 30000; // 30 segundos
        this.inactivityTimeout = 300000; // 5 minutos
        
        this.startCleanupProcess();
    }

    /**
     * Registrar nova conexão de stream
     */
    registerConnection(streamId, connectionId, req) {
        const connection = {
            id: connectionId,
            streamId,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            startTime: Date.now(),
            lastActivity: Date.now(),
            isActive: true
        };

        // Verificar limite de conexões por stream
        const streamData = this.activeStreams.get(streamId) || {
            connections: new Map(),
            createdAt: Date.now(),
            lastActivity: Date.now()
        };

        if (streamData.connections.size >= this.maxConnectionsPerStream) {
            throw new Error('Maximum connections per stream reached');
        }

        // Adicionar conexão
        streamData.connections.set(connectionId, connection);
        streamData.lastActivity = Date.now();
        this.activeStreams.set(streamId, streamData);

        // Configurar timeout de inatividade
        this.setConnectionTimeout(connectionId, streamId);

        logger.info('Stream connection registered', {
            streamId,
            connectionId,
            totalConnections: streamData.connections.size,
            ip: req.ip
        });

        return connection;
    }

    /**
     * Atualizar atividade da conexão
     */
    updateActivity(connectionId, streamId) {
        const streamData = this.activeStreams.get(streamId);
        
        if (streamData) {
            const connection = streamData.connections.get(connectionId);
            
            if (connection) {
                connection.lastActivity = Date.now();
                streamData.lastActivity = Date.now();
                
                // Resetar timeout
                this.setConnectionTimeout(connectionId, streamId);
            }
        }
    }

    /**
     * Remover conexão
     */
    removeConnection(connectionId, streamId) {
        const streamData = this.activeStreams.get(streamId);
        
        if (streamData) {
            const connection = streamData.connections.get(connectionId);
            
            if (connection) {
                connection.isActive = false;
                streamData.connections.delete(connectionId);
                
                // Limpar timeout
                const timeout = this.connectionTimeouts.get(connectionId);
                if (timeout) {
                    clearTimeout(timeout);
                    this.connectionTimeouts.delete(connectionId);
                }

                logger.info('Stream connection removed', {
                    streamId,
                    connectionId,
                    duration: Date.now() - connection.startTime,
                    remainingConnections: streamData.connections.size
                });

                // Se não há mais conexões, marcar stream como inativo
                if (streamData.connections.size === 0) {
                    streamData.lastActivity = Date.now();
                    
                    // Emitir evento para possível cleanup
                    this.emit('streamInactive', streamId);
                }
            }
        }
    }

    /**
     * Configurar timeout de conexão
     */
    setConnectionTimeout(connectionId, streamId) {
        // Limpar timeout existente
        const existingTimeout = this.connectionTimeouts.get(connectionId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Configurar novo timeout
        const timeout = setTimeout(() => {
            logger.warn('Connection timeout', { connectionId, streamId });
            this.removeConnection(connectionId, streamId);
        }, this.connectionTimeout);

        this.connectionTimeouts.set(connectionId, timeout);
    }

    /**
     * Obter informações de um stream
     */
    getStreamInfo(streamId) {
        const streamData = this.activeStreams.get(streamId);
        
        if (!streamData) {
            return null;
        }

        const connections = Array.from(streamData.connections.values());
        
        return {
            streamId,
            connectionCount: connections.length,
            lastActivity: streamData.lastActivity,
            createdAt: streamData.createdAt,
            connections: connections.map(conn => ({
                id: conn.id,
                ip: conn.ip,
                startTime: conn.startTime,
                lastActivity: conn.lastActivity,
                duration: Date.now() - conn.startTime
            }))
        };
    }

    /**
     * Verificar se stream tem conexões ativas
     */
    hasActiveConnections(streamId) {
        const streamData = this.activeStreams.get(streamId);
        return streamData && streamData.connections.size > 0;
    }

    /**
     * Obter todas as estatísticas
     */
    getStats() {
        const streams = Array.from(this.activeStreams.values());
        const totalConnections = streams.reduce((sum, stream) => sum + stream.connections.size, 0);

        return {
            totalStreams: this.activeStreams.size,
            totalConnections,
            maxConnectionsPerStream: this.maxConnectionsPerStream,
            connectionTimeout: this.connectionTimeout,
            inactivityTimeout: this.inactivityTimeout,
            streamsWithConnections: streams.filter(s => s.connections.size > 0).length
        };
    }

    /**
     * Limpar streams inativos
     */
    cleanupInactiveStreams() {
        const now = Date.now();
        const streamsToRemove = [];

        for (const [streamId, streamData] of this.activeStreams) {
            // Remover conexões expiradas
            for (const [connectionId, connection] of streamData.connections) {
                if (now - connection.lastActivity > this.connectionTimeout) {
                    this.removeConnection(connectionId, streamId);
                }
            }

            // Marcar streams completamente inativos para remoção
            if (streamData.connections.size === 0 && 
                now - streamData.lastActivity > this.inactivityTimeout) {
                streamsToRemove.push(streamId);
            }
        }

        // Remover streams inativos
        streamsToRemove.forEach(streamId => {
            this.activeStreams.delete(streamId);
            this.emit('streamInactive', streamId);
            
            logger.info('Inactive stream removed', { streamId });
        });

        return streamsToRemove.length;
    }

    /**
     * Processo de limpeza automática
     */
    startCleanupProcess() {
        setInterval(() => {
            this.cleanupInactiveStreams();
        }, 60000); // Executar a cada 1 minuto

        logger.info('Stream pool cleanup process started');
    }

    /**
     * Forçar remoção de stream
     */
    forceRemoveStream(streamId) {
        const streamData = this.activeStreams.get(streamId);
        
        if (streamData) {
            // Remover todas as conexões
            for (const [connectionId] of streamData.connections) {
                this.removeConnection(connectionId, streamId);
            }
            
            // Remover stream
            this.activeStreams.delete(streamId);
            
            logger.info('Stream force removed', { streamId });
        }
    }

    /**
     * Shutdown graceful
     */
    shutdown() {
        // Limpar todos os timeouts
        for (const timeout of this.connectionTimeouts.values()) {
            clearTimeout(timeout);
        }
        
        this.connectionTimeouts.clear();
        this.activeStreams.clear();
        
        logger.info('Stream pool service shutdown');
    }
}

// Singleton
const streamPool = new StreamPoolService();

module.exports = streamPool;