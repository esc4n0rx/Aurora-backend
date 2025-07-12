const crypto = require('crypto');

class TorrentUtils {
    /**
     * Verificar se URL é um magnet link
     */
    static isMagnetLink(url) {
        return typeof url === 'string' && url.startsWith('magnet:?');
    }

    /**
     * Extrair hash do magnet link
     */
    static extractHashFromMagnet(magnetUrl) {
        try {
            const url = new URL(magnetUrl);
            const xt = url.searchParams.get('xt');
            
            if (xt && xt.startsWith('urn:btih:')) {
                return xt.replace('urn:btih:', '').toLowerCase();
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Gerar ID único para stream
     */
    static generateStreamId(magnetUrl) {
        const hash = this.extractHashFromMagnet(magnetUrl);
        return hash || crypto.createHash('sha256').update(magnetUrl).digest('hex').substring(0, 16);
    }

    /**
     * Verificar se arquivo é vídeo
     */
    static isVideoFile(filename) {
        const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
        const ext = require('path').extname(filename).toLowerCase();
        return videoExtensions.includes(ext);
    }

    /**
     * Encontrar melhor arquivo de vídeo no torrent
     */
    static findBestVideoFile(files) {
        // Filtrar apenas arquivos de vídeo
        const videoFiles = files.filter(file => this.isVideoFile(file.name));
        
        if (videoFiles.length === 0) {
            return null;
        }

        // Se há apenas um, retornar ele
        if (videoFiles.length === 1) {
            return videoFiles[0];
        }

        // Priorizar por tamanho (maior arquivo geralmente é o principal)
        videoFiles.sort((a, b) => b.length - a.length);
        
        // Verificar se o maior arquivo é significativamente maior
        const largest = videoFiles[0];
        const secondLargest = videoFiles[1];
        
        // Se o maior arquivo é pelo menos 50% maior que o segundo, é provavelmente o principal
        if (largest.length > secondLargest.length * 1.5) {
            return largest;
        }

        // Caso contrário, verificar por palavras-chave no nome
        const mainKeywords = ['movie', 'film', 'main', 'full'];
        const sampleKeywords = ['sample', 'trailer', 'preview'];
        
        for (const file of videoFiles) {
            const filename = file.name.toLowerCase();
            
            // Excluir amostras/trailers
            if (sampleKeywords.some(keyword => filename.includes(keyword))) {
                continue;
            }
            
            // Priorizar arquivos com palavras-chave principais
            if (mainKeywords.some(keyword => filename.includes(keyword))) {
                return file;
            }
        }

        // Retornar o maior arquivo como fallback
        return largest;
    }

    /**
     * Validar configuração de torrent
     */
    static validateTorrentConfig() {
        const requiredEnvVars = ['TORRENT_MAX_CACHE_SIZE', 'TORRENT_CACHE_TTL'];
        const missing = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missing.length > 0) {
            throw new Error(`Variáveis de ambiente faltando: ${missing.join(', ')}`);
        }
    }

    /**
     * Formatar tamanho de arquivo
     */
    static formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Bytes';
        
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
}

module.exports = TorrentUtils;