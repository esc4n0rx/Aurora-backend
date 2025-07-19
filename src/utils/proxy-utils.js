const crypto = require('crypto');
const { URL } = require('url');

class ProxyUtils {
    /**
     * Validar se URL é de streaming válida
     */
    static isValidStreamingUrl(url) {
        try {
            const parsedUrl = new URL(url);
            
            // Aceitar apenas HTTP/HTTPS
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                return false;
            }
            
            // Verificar se é uma URL de streaming válida
            const path = parsedUrl.pathname.toLowerCase();
            const validExtensions = ['.m3u8', '.ts', '.mp4', '.mkv', '.avi'];
            
            return validExtensions.some(ext => path.includes(ext)) || 
                   path.includes('playlist') || 
                   path.includes('segment');
        } catch (error) {
            return false;
        }
    }

    /**
     * Gerar ID único para URL de proxy
     */
    static generateProxyId(originalUrl, contentId) {
        const hash = crypto.createHash('sha256')
            .update(originalUrl + contentId + process.env.PROXY_SECRET)
            .digest('hex')
            .substring(0, 16);
        
        return `${contentId}_${hash}`;
    }

    /**
     * Verificar se proxy ID é válido
     */
    static isValidProxyId(proxyId, originalUrl, contentId) {
        const expectedId = this.generateProxyId(originalUrl, contentId);
        return proxyId === expectedId;
    }

    /**
     * Extrair informações do User-Agent
     */
    static parseUserAgent(userAgent) {
        if (!userAgent) return { type: 'unknown', player: 'unknown' };

        const ua = userAgent.toLowerCase();
        
        // Detectar tipo de player
        if (ua.includes('vlc')) {
            return { type: 'desktop_player', player: 'vlc' };
        } else if (ua.includes('mpc')) {
            return { type: 'desktop_player', player: 'mpc' };
        } else if (ua.includes('android')) {
            return { type: 'mobile', player: 'android' };
        } else if (ua.includes('iphone') || ua.includes('ipad')) {
            return { type: 'mobile', player: 'ios' };
        } else if (ua.includes('safari')) {
            return { type: 'browser', player: 'safari' };
        } else if (ua.includes('chrome')) {
            return { type: 'browser', player: 'chrome' };
        } else if (ua.includes('firefox')) {
            return { type: 'browser', player: 'firefox' };
        }
        
        return { type: 'browser', player: 'unknown' };
    }

    /**
     * Obter headers apropriados para streaming
     */
    static getStreamingHeaders(contentType, isSegment = false) {
        const baseHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range, Accept-Encoding, Accept, User-Agent',
            'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
            'Accept-Ranges': 'bytes'
        };

        if (contentType.includes('m3u8')) {
            return {
                ...baseHeaders,
                'Content-Type': 'application/vnd.apple.mpegurl',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            };
        } else if (contentType.includes('ts') || isSegment) {
            return {
                ...baseHeaders,
                'Content-Type': 'video/mp2t',
                'Cache-Control': 'public, max-age=3600',
                'Vary': 'Accept-Encoding'
            };
        } else {
            return {
                ...baseHeaders,
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=1800',
                'Vary': 'Accept-Encoding'
            };
        }
    }

    /**
     * Limpar e normalizar URL
     */
    static normalizeUrl(url) {
        try {
            const parsedUrl = new URL(url);
            
            // Remover parâmetros desnecessários mas manter os importantes
            const importantParams = ['token', 'auth', 'key', 'session'];
            const newSearchParams = new URLSearchParams();
            
            for (const [key, value] of parsedUrl.searchParams) {
                if (importantParams.some(param => key.toLowerCase().includes(param))) {
                    newSearchParams.append(key, value);
                }
            }
            
            parsedUrl.search = newSearchParams.toString();
            return parsedUrl.toString();
        } catch (error) {
            return url;
        }
    }

    /**
     * Verificar se URL precisa de autenticação
     */
    static requiresAuth(url) {
        const authIndicators = ['token=', 'auth=', 'key=', 'session=', 'login'];
        return authIndicators.some(indicator => url.toLowerCase().includes(indicator));
    }

    /**
     * Gerar URL de proxy
     */
    static generateProxyUrl(contentId, originalUrl, baseUrl) {
        const proxyId = this.generateProxyId(originalUrl, contentId);
        return `${baseUrl}/api/v1/proxy/stream/${proxyId}`;
    }

    /**
     * Detectar tipo de conteúdo pela URL
     */
    static detectContentType(url) {
        const path = url.toLowerCase();
        
        if (path.includes('.m3u8') || path.includes('playlist')) {
            return 'playlist';
        } else if (path.includes('.ts')) {
            return 'segment';
        } else if (path.includes('.mp4')) {
            return 'video/mp4';
        } else if (path.includes('.mkv')) {
            return 'video/x-matroska';
        } else if (path.includes('.avi')) {
            return 'video/x-msvideo';
        }
        
        return 'video/mp4'; // Default
    }

    /**
     * Validar range de bytes
     */
    static parseByteRange(rangeHeader, fileSize) {
        if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
            return null;
        }

        const range = rangeHeader.substring(6);
        const [start, end] = range.split('-');
        
        const startByte = start ? parseInt(start, 10) : 0;
        const endByte = end ? parseInt(end, 10) : fileSize - 1;
        
        if (startByte >= fileSize || endByte >= fileSize || startByte > endByte) {
            return null;
        }
        
        return { start: startByte, end: endByte };
    }

    /**
     * Formatar tamanho de arquivo
     */
    static formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}

module.exports = ProxyUtils;