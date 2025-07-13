const { parentPort, workerData } = require('worker_threads');
const path = require('path');

// Worker isolado para processamento de torrents
class TorrentWorker {
    constructor() {
        this.client = null;
        this.torrents = new Map();
        this.isShuttingDown = false;
        
        this.initializeWorker();
    }

    async initializeWorker() {
        try {
            // Import dinâmico do WebTorrent
            let WebTorrent;
            try {
                const { default: WT } = await import('webtorrent');
                WebTorrent = WT;
            } catch (importError) {
                WebTorrent = require('webtorrent');
            }

            this.client = new WebTorrent();
            this.setupClientEvents();
            
            this.parentPost({
                type: 'initialized',
                data: { nodeId: this.client.nodeId }
            });
        } catch (error) {
            this.parentPost({
                type: 'error',
                data: { message: error.message }
            });
        }
    }

    setupClientEvents() {
        this.client.on('error', (error) => {
            this.parentPost({
                type: 'client_error',
                data: { message: error.message }
            });
        });

        this.client.on('torrent', (torrent) => {
            this.parentPost({
                type: 'torrent_added',
                data: { 
                    infoHash: torrent.infoHash,
                    name: torrent.name 
                }
            });
        });
    }

    async addTorrent(magnetUrl, streamId) {
        return new Promise((resolve, reject) => {
            if (this.isShuttingDown) {
                reject(new Error('Worker is shutting down'));
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error('Torrent add timeout'));
            }, 30000);

            const torrent = this.client.add(magnetUrl, {
                strategy: 'sequential',
                maxWebConns: 10
            });

            torrent.on('ready', () => {
                clearTimeout(timeout);
                
                // Encontrar melhor arquivo de vídeo
                const videoFile = this.findBestVideoFile(torrent.files);
                
                if (!videoFile) {
                    torrent.destroy();
                    reject(new Error('No video file found'));
                    return;
                }

                // Armazenar torrent
                this.torrents.set(streamId, {
                    torrent,
                    file: videoFile,
                    createdAt: Date.now(),
                    lastAccessed: Date.now()
                });

                // Configurar eventos de progresso
                this.setupProgressTracking(torrent, streamId);

                resolve({
                    streamId,
                    filename: videoFile.name,
                    fileSize: videoFile.length,
                    infoHash: torrent.infoHash
                });
            });

            torrent.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    findBestVideoFile(files) {
        const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'];
        const videoFiles = files.filter(file => {
            const ext = path.extname(file.name).toLowerCase();
            return videoExtensions.includes(ext);
        });

        if (videoFiles.length === 0) return null;
        if (videoFiles.length === 1) return videoFiles[0];

        // Ordenar por tamanho (maior primeiro)
        videoFiles.sort((a, b) => b.length - a.length);
        return videoFiles[0];
    }

    setupProgressTracking(torrent, streamId) {
        const interval = setInterval(() => {
            if (torrent.destroyed || this.isShuttingDown) {
                clearInterval(interval);
                return;
            }

            this.parentPost({
                type: 'progress_update',
                data: {
                    streamId,
                    progress: Math.round(torrent.progress * 100),
                    downloadSpeed: torrent.downloadSpeed,
                    uploadSpeed: torrent.uploadSpeed,
                    peers: torrent.numPeers
                }
            });
        }, 2000);
    }

    createFileStream(streamId, start = 0, end = null) {
        const torrentData = this.torrents.get(streamId);
        
        if (!torrentData) {
            throw new Error('Torrent not found');
        }

        const { file } = torrentData;
        torrentData.lastAccessed = Date.now();

        if (end === null) {
            end = file.length - 1;
        }

        return file.createReadStream({ start, end });
    }

    getTorrentInfo(streamId) {
        const torrentData = this.torrents.get(streamId);
        
        if (!torrentData) {
            return null;
        }

        const { torrent, file } = torrentData;

        return {
            streamId,
            filename: file.name,
            fileSize: file.length,
            progress: Math.round(torrent.progress * 100),
            downloadSpeed: torrent.downloadSpeed,
            uploadSpeed: torrent.uploadSpeed,
            peers: torrent.numPeers,
            infoHash: torrent.infoHash
        };
    }

    removeTorrent(streamId) {
        const torrentData = this.torrents.get(streamId);
        
        if (torrentData) {
            const { torrent } = torrentData;
            
            if (!torrent.destroyed) {
                torrent.destroy();
            }
            
            this.torrents.delete(streamId);
            
            this.parentPost({
                type: 'torrent_removed',
                data: { streamId }
            });
        }
    }

    cleanupInactive() {
        const now = Date.now();
        const inactiveThreshold = 30 * 60 * 1000; // 30 minutos

        for (const [streamId, torrentData] of this.torrents) {
            if (now - torrentData.lastAccessed > inactiveThreshold) {
                this.removeTorrent(streamId);
            }
        }
    }

    getStats() {
        return {
            torrentsCount: this.torrents.size,
            clientStats: this.client ? {
                downloadSpeed: this.client.downloadSpeed,
                uploadSpeed: this.client.uploadSpeed,
                torrentsCount: this.client.torrents.length
            } : null
        };
    }

    shutdown() {
        this.isShuttingDown = true;
        
        // Destruir todos os torrents
        for (const [streamId] of this.torrents) {
            this.removeTorrent(streamId);
        }

        // Destruir cliente
        if (this.client) {
            this.client.destroy();
        }

        this.parentPost({
            type: 'shutdown_complete'
        });
    }

    parentPost(message) {
        if (parentPort) {
            parentPort.postMessage(message);
        }
    }
}

// Inicializar worker
const worker = new TorrentWorker();

// Escutar mensagens do thread principal
if (parentPort) {
    parentPort.on('message', async (message) => {
        try {
            const { type, data } = message;

            switch (type) {
                case 'add_torrent':
                    const result = await worker.addTorrent(data.magnetUrl, data.streamId);
                    parentPort.postMessage({
                        type: 'torrent_ready',
                        data: result,
                        requestId: data.requestId
                    });
                    break;

                case 'get_info':
                    const info = worker.getTorrentInfo(data.streamId);
                    parentPort.postMessage({
                        type: 'torrent_info',
                        data: info,
                        requestId: data.requestId
                    });
                    break;

                case 'remove_torrent':
                    worker.removeTorrent(data.streamId);
                    break;

                case 'cleanup':
                    worker.cleanupInactive();
                    break;

                case 'get_stats':
                    const stats = worker.getStats();
                    parentPort.postMessage({
                        type: 'stats',
                        data: stats,
                        requestId: data.requestId
                    });
                    break;

                case 'shutdown':
                    worker.shutdown();
                    break;
            }
        } catch (error) {
            parentPort.postMessage({
                type: 'error',
                data: { message: error.message },
                requestId: message.data?.requestId
            });
        }
    });
}