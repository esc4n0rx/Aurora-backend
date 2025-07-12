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
     * Registrar visualização
     */
    static async recordView(contentId, viewData, ipAddress, userAgent) {
        // Verificar se conteúdo existe e está ativo
        const content = await ContentModel.findById(contentId);
        if (!content) {
            throw new Error('Conteúdo não encontrado');
        }

        if (!content.ativo) {
            throw new Error('Conteúdo não está ativo');
        }

        // Verificar se IP já visualizou recentemente (evitar spam)
        const hasRecentView = await ContentViewModel.hasRecentView(contentId, ipAddress, 30);
        if (hasRecentView) {
            throw new Error('Visualização já registrada recentemente para este IP');
        }

        // Registrar visualização
        const viewRecord = await ContentViewModel.create({
            content_id: contentId,
            user_id: viewData.user_id || null,
            profile_id: viewData.profile_id || null,
            ip_address: ipAddress,
            user_agent: userAgent,
            view_duration: viewData.view_duration || null,
            view_percentage: viewData.view_percentage || null
        });

        return viewRecord;
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
}

module.exports = ContentService;