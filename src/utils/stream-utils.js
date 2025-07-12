const mime = require('mime-types');
const rangeParser = require('range-parser');

class StreamUtils {
    /**
     * Obter Content-Type baseado na extensão do arquivo
     */
    static getContentType(filename) {
        const mimeType = mime.lookup(filename);
        return mimeType || 'application/octet-stream';
    }

    /**
     * Processar header Range para streaming
     */
    static parseRange(rangeHeader, fileSize) {
        if (!rangeHeader) {
            return null;
        }

        const ranges = rangeParser(fileSize, rangeHeader, { combine: true });
        
        if (ranges === -1 || ranges === -2 || !ranges.length) {
            return null;
        }

        return ranges[0]; // Usar apenas o primeiro range
    }

    /**
     * Gerar headers para resposta de stream
     */
    static generateStreamHeaders(filename, fileSize, range = null) {
        const contentType = this.getContentType(filename);
        
        const headers = {
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600',
            'Content-Security-Policy': "default-src 'self'",
            'X-Content-Type-Options': 'nosniff'
        };

        if (range) {
            const { start, end } = range;
            const contentLength = end - start + 1;
            
            headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
            headers['Content-Length'] = contentLength;
            
            return { headers, statusCode: 206, start, end };
        } else {
            headers['Content-Length'] = fileSize;
            return { headers, statusCode: 200, start: 0, end: fileSize - 1 };
        }
    }

    /**
     * Validar se request é para streaming de vídeo
     */
    static isVideoStreamRequest(userAgent) {
        const videoPlayers = ['vlc', 'mpc', 'video', 'media', 'player'];
        const browsers = ['mozilla', 'chrome', 'safari', 'edge', 'firefox'];
        
        if (!userAgent) return false;
        
        const ua = userAgent.toLowerCase();
        
        // Aceitar players de vídeo conhecidos
        if (videoPlayers.some(player => ua.includes(player))) {
            return true;
        }
        
        // Aceitar browsers comuns
        if (browsers.some(browser => ua.includes(browser))) {
            return true;
        }
        
        return false;
    }

    /**
     * Calcular taxa de transferência ótima
     */
    static calculateOptimalChunkSize(fileSize) {
        // Chunk size baseado no tamanho do arquivo
        if (fileSize < 100 * 1024 * 1024) { // < 100MB
            return 64 * 1024; // 64KB
        } else if (fileSize < 1024 * 1024 * 1024) { // < 1GB
            return 256 * 1024; // 256KB
        } else {
            return 1024 * 1024; // 1MB
        }
    }

    /**
     * Verificar se cliente suporta streaming
     */
    static supportsStreaming(req) {
        const userAgent = req.get('User-Agent');
        const acceptRanges = req.get('Range');
        
        return this.isVideoStreamRequest(userAgent) || !!acceptRanges;
    }
}

module.exports = StreamUtils;