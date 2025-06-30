const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

// Configurar CORS para permitir todas as origens
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'Accept', 'User-Agent'],
    credentials: false
}));

// Middleware para logs
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Função para adicionar cabeçalhos CORS
function addCorsHeaders(res) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, Accept, User-Agent');
    res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
}

// Rota principal do proxy
app.get('/', async (req, res) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    console.log(`Proxying request to: ${targetUrl}`);

    try {
        // Configurar axios para seguir redirecionamentos e adicionar headers apropriados
        const axiosConfig = {
            method: 'GET',
            url: targetUrl,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            maxRedirects: 10, // Seguir até 10 redirecionamentos
            validateStatus: function (status) {
                return status >= 200 && status < 400; // Aceitar códigos de sucesso e redirecionamento
            },
            responseType: 'stream', // Para lidar com streams de vídeo
            timeout: 30000 // 30 segundos de timeout
        };

        // Se há headers Range na requisição original, incluí-los
        if (req.headers.range) {
            axiosConfig.headers['Range'] = req.headers.range;
        }

        const response = await axios(axiosConfig);
        
        console.log(`Response status: ${response.status}`);
        console.log(`Response headers:`, response.headers);
        
        // Adicionar cabeçalhos CORS
        addCorsHeaders(res);
        
        // Copiar cabeçalhos relevantes da resposta original
        if (response.headers['content-type']) {
            res.header('Content-Type', response.headers['content-type']);
        }
        if (response.headers['content-length']) {
            res.header('Content-Length', response.headers['content-length']);
        }
        if (response.headers['content-range']) {
            res.header('Content-Range', response.headers['content-range']);
        }
        if (response.headers['accept-ranges']) {
            res.header('Accept-Ranges', response.headers['accept-ranges']);
        }
        
        // Definir status da resposta
        res.status(response.status);
        
        // Se for um manifesto HLS, processar o conteúdo para garantir que URLs relativas passem pelo proxy
        if (response.headers['content-type'] && 
            (response.headers['content-type'].includes('application/vnd.apple.mpegurl') || 
             response.headers['content-type'].includes('application/x-mpegURL') ||
             targetUrl.includes('.m3u8'))) {
            
            let manifestContent = '';
            response.data.on('data', chunk => {
                manifestContent += chunk.toString();
            });
            
            response.data.on('end', () => {
                // Processar o manifesto para garantir que todas as URLs passem pelo proxy
                const processedManifest = processM3U8Manifest(manifestContent, targetUrl, req);
                console.log('Processed manifest:', processedManifest);
                res.send(processedManifest);
            });
            
        } else {
            // Para outros tipos de conteúdo, apenas fazer pipe da resposta
            response.data.pipe(res);
        }
        
    } catch (error) {
        console.error('Proxy error:', error.message);
        
        // Adicionar cabeçalhos CORS mesmo em caso de erro
        addCorsHeaders(res);
        
        if (error.response) {
            // Erro HTTP
            res.status(error.response.status).json({ 
                error: 'Proxy error', 
                details: error.message,
                status: error.response.status
            });
        } else if (error.request) {
            // Erro de rede
            res.status(502).json({ 
                error: 'Network error', 
                details: error.message 
            });
        } else {
            // Outro tipo de erro
            res.status(500).json({ 
                error: 'Internal proxy error', 
                details: error.message 
            });
        }
    }
});

// Função para processar manifestos M3U8 e garantir que URLs passem pelo proxy
function processM3U8Manifest(manifestContent, originalUrl, req) {
    const lines = manifestContent.split('\n');
    const processedLines = [];
    
    for (let line of lines) {
        if (line.trim() && !line.startsWith('#')) {
            // Esta é uma URL de segmento ou sub-manifesto
            let segmentUrl = line.trim();
            
            // Se for uma URL relativa, torná-la absoluta
            if (!segmentUrl.startsWith('http')) {
                const baseUrl = originalUrl.substring(0, originalUrl.lastIndexOf('/') + 1);
                segmentUrl = baseUrl + segmentUrl;
            }
            
            // Fazer a URL passar pelo proxy
            const proxyUrl = `${req.protocol}://${req.get('host')}?url=${encodeURIComponent(segmentUrl)}`;
            processedLines.push(proxyUrl);
        } else {
            // Linha de comentário ou vazia, manter como está
            processedLines.push(line);
        }
    }
    
    return processedLines.join('\n');
}

// Rota de health check
app.get('/health', (req, res) => {
    addCorsHeaders(res);
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Middleware para lidar com OPTIONS (preflight)
app.options('*', (req, res) => {
    addCorsHeaders(res);
    res.sendStatus(200);
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor proxy v2 rodando na porta ${PORT}`);
    console.log(`Health check disponível em: http://localhost:${PORT}/health`);
});

