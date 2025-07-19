class HLSUtils {
    /**
     * Parsear playlist M3U8
     */
    static parseM3U8(content) {
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);
        const playlist = {
            version: null,
            targetDuration: null,
            mediaSequence: null,
            segments: [],
            endList: false,
            isVariantPlaylist: false,
            variants: []
        };

        let i = 0;
        while (i < lines.length) {
            const line = lines[i];

            if (line.startsWith('#EXTM3U')) {
                // Header da playlist
            } else if (line.startsWith('#EXT-X-VERSION:')) {
                playlist.version = parseInt(line.split(':')[1]);
            } else if (line.startsWith('#EXT-X-TARGETDURATION:')) {
                playlist.targetDuration = parseInt(line.split(':')[1]);
            } else if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
                playlist.mediaSequence = parseInt(line.split(':')[1]);
            } else if (line.startsWith('#EXT-X-ENDLIST')) {
                playlist.endList = true;
            } else if (line.startsWith('#EXT-X-STREAM-INF:')) {
                // Variant playlist
                playlist.isVariantPlaylist = true;
                const variantInfo = this.parseStreamInf(line);
                const url = lines[i + 1];
                
                playlist.variants.push({
                    ...variantInfo,
                    url: url
                });
                i++; // Pular próxima linha (URL)
            } else if (line.startsWith('#EXTINF:')) {
                // Segment
                const duration = parseFloat(line.split(':')[1].split(',')[0]);
                const title = line.split(',')[1] || '';
                const url = lines[i + 1];
                
                playlist.segments.push({
                    duration,
                    title,
                    url
                });
                i++; // Pular próxima linha (URL)
            }
            
            i++;
        }

        return playlist;
    }

    /**
     * Parsear informações de EXT-X-STREAM-INF
     */
    static parseStreamInf(line) {
        const info = {};
        const content = line.substring(line.indexOf(':') + 1);
        
        // Parsear atributos
        const attributes = content.split(',');
        attributes.forEach(attr => {
            const [key, value] = attr.split('=');
            if (key && value) {
                const cleanKey = key.trim();
                const cleanValue = value.replace(/"/g, '');
                
                if (cleanKey === 'BANDWIDTH') {
                    info.bandwidth = parseInt(cleanValue);
                } else if (cleanKey === 'RESOLUTION') {
                    info.resolution = cleanValue;
                } else if (cleanKey === 'CODECS') {
                    info.codecs = cleanValue;
                } else if (cleanKey === 'FRAME-RATE') {
                    info.frameRate = parseFloat(cleanValue);
                }
            }
        });

        return info;
    }

    /**
     * Modificar URLs em playlist M3U8 para usar proxy
     */
    static modifyPlaylistUrls(content, baseUrl, proxyBaseUrl) {
        const lines = content.split('\n');
        const modifiedLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Se é uma URL (não começa com #)
            if (line && !line.startsWith('#')) {
                const absoluteUrl = this.resolveUrl(line, baseUrl);
                const proxyUrl = this.convertToProxyUrl(absoluteUrl, proxyBaseUrl);
                modifiedLines.push(proxyUrl);
            } else {
                modifiedLines.push(lines[i]);
            }
        }

        return modifiedLines.join('\n');
    }

    /**
     * Resolver URL relativa para absoluta
     */
    static resolveUrl(url, baseUrl) {
        try {
            // Se já é absoluta, retornar como está
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return url;
            }
            
            // Criar URL absoluta baseada na base
            const base = new URL(baseUrl);
            const resolved = new URL(url, base);
            return resolved.toString();
        } catch (error) {
            return url;
        }
    }

    /**
     * Converter URL para URL de proxy
     */
    static convertToProxyUrl(originalUrl, proxyBaseUrl) {
        const encodedUrl = Buffer.from(originalUrl).toString('base64url');
        return `${proxyBaseUrl}/segment/${encodedUrl}`;
    }

    /**
     * Decodificar URL do proxy
     */
    static decodeProxyUrl(encodedUrl) {
        try {
            return Buffer.from(encodedUrl, 'base64url').toString('utf-8');
        } catch (error) {
            return null;
        }
    }

    /**
     * Validar playlist M3U8
     */
    static isValidM3U8(content) {
        if (!content || typeof content !== 'string') {
            return false;
        }

        const lines = content.split('\n');
        
        // Deve começar com #EXTM3U
        if (!lines[0] || !lines[0].trim().startsWith('#EXTM3U')) {
            return false;
        }

        // Deve ter pelo menos uma linha válida
        return lines.some(line => 
            line.startsWith('#EXT-X-') || 
            line.startsWith('#EXTINF:') ||
            (!line.startsWith('#') && line.trim().length > 0)
        );
    }

    /**
     * Obter qualidade da resolução
     */
    static getQualityFromResolution(resolution) {
        if (!resolution) return 'auto';
        
        const qualityMap = {
            '1920x1080': '1080p',
            '1280x720': '720p',
            '854x480': '480p',
            '640x360': '360p',
            '426x240': '240p'
        };
        
        return qualityMap[resolution] || 'auto';
    }

    /**
     * Ordenar variants por qualidade
     */
    static sortVariantsByQuality(variants) {
        return variants.sort((a, b) => {
            if (a.bandwidth && b.bandwidth) {
                return b.bandwidth - a.bandwidth;
            }
            return 0;
        });
    }

    /**
     * Filtrar variants por qualidade máxima
     */
    static filterVariantsByMaxQuality(variants, maxQuality) {
        const qualityOrder = ['240p', '360p', '480p', '720p', '1080p', '1440p', '4k'];
        const maxIndex = qualityOrder.indexOf(maxQuality);
        
        if (maxIndex === -1) return variants;
        
        return variants.filter(variant => {
            const quality = this.getQualityFromResolution(variant.resolution);
            const qualityIndex = qualityOrder.indexOf(quality);
            return qualityIndex <= maxIndex;
        });
    }
}

module.exports = HLSUtils;