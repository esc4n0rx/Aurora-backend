const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');
const ProxyUtils = require('../utils/proxy-utils');
const HLSUtils = require('../utils/hls-utils');
const proxyCacheService = require('./proxy-cache-service');
const ContentService = require('./content-service');
const { logger } = require('../config/logger');

class ProxyService {
    constructor() {
        this.activeConnections = new Map();
        this.maxConnections = parseInt(process.env.MAX_PROXY_CONNECTIONS) || 100;
        this.requestTimeout = parseInt(process.env.PROXY_REQUEST_TIMEOUT) || 30000;
        
        // Configurar axios com timeout e retry
        this.httpClient = axios.create({
            timeout: this.requestTimeout,
            maxRedirects: 5,
            validateStatus: (status) => status < 500 // Aceitar redirecionamentos
        });
    }

    /**
     * Criar proxy para conteúdo
     */
    async createContentProxy(contentId, originalUrl) {
        try {
            // Validar URL
            if (!ProxyUtils.isValidStreamingUrl(originalUrl)) {
                throw new Error('URL de streaming inválida');
            }

            // Gerar ID do proxy
            const proxyId = ProxyUtils.generateProxyId(originalUrl, contentId);
            
            // Normalizar URL
            const normalizedUrl = ProxyUtils.normalizeUrl(originalUrl);
            
            // Criar informações do proxy
            const proxyInfo = {
                contentId,
                originalUrl: normalizedUrl,
                proxyId,
                createdAt: new Date().toISOString(),
                requiresAuth: ProxyUtils.requiresAuth(normalizedUrl),
                contentType: ProxyUtils.detectContentType(normalizedUrl)
            };

            // Armazenar no cache
            proxyCacheService.setProxyInfo(proxyId, proxyInfo);
            
            // Gerar URL do proxy
            const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
            const proxyUrl = ProxyUtils.generateProxyUrl(contentId, normalizedUrl, baseUrl);
            
            logger.info('Content proxy created', {
                contentId,
                proxyId,
                originalUrl: normalizedUrl,
                proxyUrl
            });

            return {
                proxyId,
                proxyUrl,
                originalUrl: normalizedUrl,
                contentType: proxyInfo.contentType,
                requiresAuth: proxyInfo.requiresAuth
            };
        } catch (error) {
            logger.error('Failed to create content proxy', {
                contentId,
                originalUrl,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Obter proxy info por ID
     */
    async getProxyInfo(proxyId) {
        return proxyCacheService.getProxyInfo(proxyId);
    }

    /**
     * Fazer proxy de requisição de streaming
     */
    async proxyStreamRequest(proxyId, req, res) {
        const connectionId = `${proxyId}_${Date.now()}`;
        
        try {
            // Verificar limite de conexões
            if (this.activeConnections.size >= this.maxConnections) {
                throw new Error('Limite máximo de conexões de proxy atingido');
            }

            // Obter informações do proxy
            const proxyInfo = await this.getProxyInfo(proxyId);
            if (!proxyInfo) {
                throw new Error('Proxy não encontrado ou expirado');
            }

            // Registrar conexão
            this.activeConnections.set(connectionId, {
                proxyId,
                startTime: Date.now(),
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });

            // Configurar cleanup
            const cleanup = () => {
                this.activeConnections.delete(connectionId);
            };

            req.on('close', cleanup);
            req.on('aborted', cleanup);
            res.on('finish', cleanup);

            // Determinar tipo de requisição
            const contentType = ProxyUtils.detectContentType(proxyInfo.originalUrl);
            
            if (contentType === 'playlist') {
                return await this.proxyPlaylist(proxyInfo, req, res);
            } else {
                return await this.proxySegment(proxyInfo, req, res);
            }
        } catch (error) {
            this.activeConnections.delete(connectionId);
            logger.error('Proxy stream request failed', {
                proxyId,
                connectionId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Fazer proxy de playlist M3U8
     */
    async proxyPlaylist(proxyInfo, req, res) {
        try {
            const { originalUrl } = proxyInfo;
            
            // Verificar cache primeiro
            const cached = proxyCacheService.getPlaylist(originalUrl);
            if (cached) {
                logger.info('Playlist served from cache', { originalUrl });
                
                // Configurar headers
                const headers = ProxyUtils.getStreamingHeaders('application/vnd.apple.mpegurl');
                Object.entries(headers).forEach(([key, value]) => {
                    res.set(key, value);
                });
                
                return res.send(cached.content);
            }

            // Buscar playlist original
            const response = await this.httpClient.get(originalUrl, {
                headers: {
                    'User-Agent': req.get('User-Agent') || 'Aurora+ Proxy/1.0',
               'Accept': '*/*',
               'Accept-Encoding': 'gzip, deflate',
               'Connection': 'keep-alive'
           },
           responseType: 'text'
       });

       const originalContent = response.data;
       
       // Validar se é M3U8 válido
       if (!HLSUtils.isValidM3U8(originalContent)) {
           throw new Error('Conteúdo M3U8 inválido recebido');
       }

       // Modificar URLs na playlist para usar nosso proxy
       const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
       const proxyBaseUrl = `${baseUrl}/api/v1/proxy`;
       const modifiedContent = HLSUtils.modifyPlaylistUrls(
           originalContent, 
           originalUrl, 
           proxyBaseUrl
       );

       // Armazenar no cache
       proxyCacheService.setPlaylist(originalUrl, modifiedContent, response.headers);

       // Configurar headers de resposta
       const headers = ProxyUtils.getStreamingHeaders('application/vnd.apple.mpegurl');
       Object.entries(headers).forEach(([key, value]) => {
           res.set(key, value);
       });

       logger.info('Playlist proxied successfully', {
           originalUrl,
           contentLength: modifiedContent.length
       });

       res.send(modifiedContent);
   } catch (error) {
       logger.error('Failed to proxy playlist', {
           originalUrl: proxyInfo.originalUrl,
           error: error.message
       });
       throw error;
   }
}

/**
* Fazer proxy de segmento de vídeo
*/
async proxySegment(proxyInfo, req, res) {
   try {
       const { originalUrl } = proxyInfo;
       const range = req.get('Range');
       
       // Verificar cache para segmentos pequenos
       const cached = proxyCacheService.getSegment(originalUrl);
       if (cached && !range) {
           logger.info('Segment served from cache', { originalUrl });
           
           // Configurar headers
           const headers = ProxyUtils.getStreamingHeaders(proxyInfo.contentType, true);
           Object.entries(headers).forEach(([key, value]) => {
               res.set(key, value);
           });
           
           res.set('Content-Length', cached.buffer.length);
           return res.send(cached.buffer);
       }

       // Configurar headers de requisição
       const requestHeaders = {
           'User-Agent': req.get('User-Agent') || 'Aurora+ Proxy/1.0',
           'Accept': '*/*',
           'Accept-Encoding': 'gzip, deflate',
           'Connection': 'keep-alive'
       };

       // Adicionar Range header se presente
       if (range) {
           requestHeaders['Range'] = range;
       }

       // Fazer requisição
       const response = await this.httpClient.get(originalUrl, {
           headers: requestHeaders,
           responseType: 'stream'
       });

       // Configurar headers de resposta
       const headers = ProxyUtils.getStreamingHeaders(
           response.headers['content-type'] || proxyInfo.contentType, 
           true
       );
       
       Object.entries(headers).forEach(([key, value]) => {
           res.set(key, value);
       });

       // Copiar headers importantes da resposta original
       const importantHeaders = [
           'content-length',
           'content-range',
           'accept-ranges',
           'last-modified',
           'etag'
       ];

       importantHeaders.forEach(headerName => {
           const value = response.headers[headerName];
           if (value) {
               res.set(headerName, value);
           }
       });

       // Configurar status code
       res.status(response.status);

       // Se não é range request e o arquivo é pequeno, cachear
       if (!range && response.headers['content-length']) {
           const contentLength = parseInt(response.headers['content-length']);
           const maxCacheSize = 10 * 1024 * 1024; // 10MB
           
           if (contentLength < maxCacheSize) {
               const chunks = [];
               response.data.on('data', chunk => {
                   chunks.push(chunk);
                   res.write(chunk);
               });
               
               response.data.on('end', () => {
                   const buffer = Buffer.concat(chunks);
                   proxyCacheService.setSegment(originalUrl, buffer, response.headers);
                   res.end();
               });
               
               response.data.on('error', (error) => {
                   logger.error('Stream error', { error: error.message });
                   res.destroy();
               });
               
               return;
           }
       }

       // Stream direto sem cache
       response.data.pipe(res);
       
       logger.info('Segment proxied successfully', {
           originalUrl,
           hasRange: !!range,
           statusCode: response.status
       });

   } catch (error) {
       logger.error('Failed to proxy segment', {
           originalUrl: proxyInfo.originalUrl,
           error: error.message
       });
       throw error;
   }
}

/**
* Fazer proxy de URL codificada (para segmentos de playlist)
*/
async proxyEncodedUrl(encodedUrl, req, res) {
   try {
       // Decodificar URL
       const originalUrl = HLSUtils.decodeProxyUrl(encodedUrl);
       if (!originalUrl) {
           throw new Error('URL codificada inválida');
       }

       // Validar URL
       if (!ProxyUtils.isValidStreamingUrl(originalUrl)) {
           throw new Error('URL decodificada inválida');
       }

       // Criar proxy info temporário
       const tempProxyInfo = {
           originalUrl,
           contentType: ProxyUtils.detectContentType(originalUrl)
       };

       // Fazer proxy baseado no tipo
       const contentType = ProxyUtils.detectContentType(originalUrl);
       
       if (contentType === 'playlist') {
           return await this.proxyPlaylist(tempProxyInfo, req, res);
       } else {
           return await this.proxySegment(tempProxyInfo, req, res);
       }
   } catch (error) {
       logger.error('Failed to proxy encoded URL', {
           encodedUrl,
           error: error.message
       });
       throw error;
   }
}

/**
* Obter estatísticas do proxy
*/
getStats() {
   const cacheStats = proxyCacheService.getStats();
   
   return {
       activeConnections: this.activeConnections.size,
       maxConnections: this.maxConnections,
       cache: cacheStats,
       uptime: process.uptime(),
       memory: process.memoryUsage()
   };
}

/**
* Limpar conexões inativas
*/
cleanupConnections() {
   const now = Date.now();
   const timeout = 5 * 60 * 1000; // 5 minutos
   let removed = 0;

   for (const [connectionId, connection] of this.activeConnections) {
       if (now - connection.startTime > timeout) {
           this.activeConnections.delete(connectionId);
           removed++;
       }
   }

   if (removed > 0) {
       logger.info('Cleaned up inactive proxy connections', { removed });
   }
}
}

// Singleton
const proxyService = new ProxyService();

// Limpeza automática de conexões a cada 5 minutos
setInterval(() => {
   proxyService.cleanupConnections();
}, 5 * 60 * 1000);

module.exports = proxyService;