const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║            AURORA+ API                ║
    ║                                       ║
    ║  🚀 Servidor rodando na porta ${PORT}     ║
    ║  🌍 Ambiente: ${process.env.NODE_ENV || 'development'}              ║
    ║  📊 Health: http://localhost:${PORT}/health ║
    ║                                       ║
    ╚═══════════════════════════════════════╝
    `);
});