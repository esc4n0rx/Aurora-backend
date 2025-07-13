const ContentModel = require('../models/content-model');
const ContentViewModel = require('../models/content-view-model');
const ContentUtils = require('../utils/content-utils');
const TorrentUtils = require('../utils/torrent-utils');

class ContentService {
    /**
     * Criar novo conteúdo
     */
    static async createContent(contentData) {
        // Sanitizar metadados
        if (contentData.metadata) {
            contentData.metadata = ContentUtils.sanitizeMetadata(contentData.metadata);
        }

        // Validar URL de transmissão
        if (contentData.url_transmissao) {
            // Se for magnet link, validar formato
            if (TorrentUtils.isMagnetLink(contentData.url_transmissao)) {
                const hash = TorrentUtils.extractHashFromMagnet(contentData.url_transmissao);
                if (!hash) {
                    throw new Error('Magnet link inválido - hash não encontrado');
                }
            }
        }

        const content = await ContentModel.create(contentData);
        return ContentUtils.formatContentResponse(content);
    }

    /**
     * Obter conteúdo por ID
     */
    static async getContentById(id) {
        const content = await ContentModel.findById(id);
        
        if (!content) {
            throw new Error('Conteúdo não encontrado');
        }

        return ContentUtils.formatContentResponse(content);
    }

    /**
     * Listar conteúdos com filtros
     */
    static async listContents(filters) {
        const result = await ContentModel.findMany(filters);
        
        return {
            ...result,
            data: result.data.map(content => ContentUtils.formatContentResponse(content))
        };
    }

    /**
     * Atualizar conteúdo
     */
    static async updateContent(id, updateData) {
        // Verificar se conteúdo existe
        const existingContent = await ContentModel.findById(id);
        if (!existingContent) {
            throw new Error('Conteúdo não encontrado');
        }

        // Sanitizar metadados se fornecidos
        if (updateData.metadata) {
            updateData.metadata = ContentUtils.sanitizeMetadata(updateData.metadata);
        }

        // Validar URL de transmissão se fornecida
        if (updateData.url_transmissao) {
            if (TorrentUtils.isMagnetLink(updateData.url_transmissao)) {
                const hash = TorrentUtils.extractHashFromMagnet(updateData.url_transmissao);
                if (!hash) {
                    throw new Error('Magnet link inválido - hash não encontrado');
                }
            }
        }

        const content = await ContentModel.update(id, updateData);
        return ContentUtils.formatContentResponse(content);
    }

    /**
     * Excluir conteúdo
     */
    static async deleteContent(id) {
        // Verificar se conteúdo existe
        const existingContent = await ContentModel.findById(id);
        if (!existingContent) {
            throw new Error('Conteúdo não encontrado');
        }

        await ContentModel.delete(id);
        return { message: 'Conteúdo excluído com sucesso' };
    }

    /**
     * Registrar visualização (CORRIGIDO para permitir re-assistir)
     */
    static async recordView(contentId, viewData, ipAddress, userAgent, forceNew = false) {
        // Verificar se conteúdo existe e está ativo
        const content = await ContentModel.findById(contentId);
        if (!content) {
            throw new Error('Conteúdo não encontrado');
        }

        if (!content.ativo) {
            throw new Error('Conteúdo não está ativo');
        }

        // Verificar se IP já visualizou recentemente (apenas se não forçar nova view)
        if (!forceNew) {
            const hasRecentView = await ContentViewModel.hasRecentView(contentId, ipAddress, 10); // Reduzido para 10 minutos
            if (hasRecentView) {
                // Se já viu recentemente, retornar info da view existente sem erro
                return {
                    id: 'existing_view',
                    content_id: contentId,
                    ip_address: ipAddress,
                    created_at: new Date().toISOString(),
                    message: 'Visualização já registrada recentemente',
                    is_existing: true
                };
            }
        }

        // Registrar nova visualização
        const viewRecord = await ContentViewModel.create({
            content_id: contentId,
            user_id: viewData.user_id || null,
            profile_id: viewData.profile_id || null,
            ip_address: ipAddress,
            user_agent: userAgent,
            view_duration: viewData.view_duration || null,
            view_percentage: viewData.view_percentage || null
        });

        return {
            ...viewRecord,
            is_existing: false
        };
    }

    /**
     * Obter conteúdos populares
     */
    static async getPopularContents(limit = 10) {
        const contents = await ContentModel.findPopular(limit);
        return contents.map(content => ContentUtils.formatContentResponse(content));
    }

    /**
     * Obter episódios de uma série
     */
    static async getSeriesEpisodes(seriesName, season = null) {
        const episodes = await ContentModel.findEpisodesBySeries(seriesName, season);
        return episodes.map(episode => ContentUtils.formatContentResponse(episode));
    }

    /**
     * Obter estatísticas gerais
     */
    static async getContentStats() {
        return await ContentModel.getStats();
    }

    /**
     * Obter estatísticas de visualização de um conteúdo
     */
    static async getContentViewStats(contentId, timeRange = '7d') {
        // Verificar se conteúdo existe
        const content = await ContentModel.findById(contentId);
        if (!content) {
            throw new Error('Conteúdo não encontrado');
        }

        const viewStats = await ContentViewModel.getViewStats(contentId, timeRange);
        const uniqueViews = await ContentViewModel.getUniqueViews(contentId);

        return {
            content: ContentUtils.formatContentResponse(content),
            viewStats,
            uniqueViewsCount: uniqueViews.length,
            totalViews: content.total_visualizations
        };
    }

    /**
     * Iniciar streaming de conteúdo (NOVO - fluxo simplificado)
     */
    static async startStreaming(contentId, viewData, ipAddress, userAgent, intent = 'watch') {
        // Obter detalhes do conteúdo
        const content = await this.getContentById(contentId);
        
        if (!content.ativo) {
            throw new Error('Conteúdo não está ativo');
        }

        let streamInfo = null;
        let viewRecord = null;

        try {
            // Tentar registrar visualização (não falhar se já existir)
            const forceNew = intent === 'rewatch';
            viewRecord = await this.recordView(contentId, viewData, ipAddress, userAgent, forceNew);
        } catch (viewError) {
            // Se falhar ao registrar view, continuar com streaming
            console.warn('View registration failed, continuing with streaming:', viewError.message);
        }

        // Se for torrent, preparar stream
        if (TorrentUtils.isMagnetLink(content.url_transmissao)) {
            const torrentService = require('./torrent-service');
            
            try {
                const streamData = await torrentService.startTorrentStream(content.url_transmissao);
                streamInfo = {
                    type: 'torrent',
                    streamId: streamData.streamId,
                    streamUrl: `/api/v1/stream/${streamData.streamId}/video`,
                    statusUrl: `/api/v1/stream/content/${contentId}/status`,
                    filename: streamData.filename,
                    fileSize: streamData.fileSize,
                    progress: streamData.progress || 0
                };
            } catch (torrentError) {
                // Log erro mas não falhar
                console.warn('Torrent stream start failed:', torrentError.message);
                streamInfo = {
                    type: 'torrent',
                    status: 'failed',
                    error: torrentError.message,
                    retry: true
                };
            }
        } else {
            // Stream direto
            streamInfo = {
                type: 'direct',
                url: content.url_transmissao,
                ready: true
            };
        }

        return {
            content: {
                id: content.id,
                nome: content.nome,
                categoria: content.categoria,
                subcategoria: content.subcategoria,
                poster: content.poster,
                backdrop: content.backdrop,
                isTorrent: TorrentUtils.isMagnetLink(content.url_transmissao)
            },
            view: viewRecord,
            streaming: streamInfo,
            ready: streamInfo.type === 'direct' || streamInfo.status !== 'failed'
        };
    }
}

module.exports = ContentService;