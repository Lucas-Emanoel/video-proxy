const express = require(\'express\');
const fetch = require(\'node-fetch\');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para permitir CORS em todas as rotas
app.use((req, res, next) => {
  res.setHeader(\'Access-Control-Allow-Origin\', \'*\');
  res.setHeader(\'Access-Control-Allow-Methods\', \'GET, POST, OPTIONS\');
  res.setHeader(\'Access-Control-Allow-Headers\', \'Content-Type, Range\');
  res.setHeader(\'Access-Control-Expose-Headers\', \'Content-Length, Content-Range, Accept-Ranges\');
  if (req.method === \'OPTIONS\') {
    return res.status(200).end();
  }
  next();
});

app.get(\'/api/proxy\', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({
      error: \'URL do vídeo é obrigatória\',
      usage: \'Use: /api/proxy?url=URL_DO_VIDEO\'
    });
  }

  try {
    const headers = {
      \'User-Agent\': \'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36\'
    };

    if (req.headers.range) {
      headers[\'Range\'] = req.headers.range;
    }

    const response = await fetch(url, {
      method: \'GET\',
      headers: headers,
      timeout: 30000 // 30 segundos de timeout
    });

    if (!response.ok) {
      throw new Error(`Erro ao buscar vídeo: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get(\'content-type\');
    const contentLength = response.headers.get(\'content-length\');
    const acceptRanges = response.headers.get(\'accept-ranges\');
    const contentRange = response.headers.get(\'content-range\');

    if (contentType) {
      res.setHeader(\'Content-Type\', contentType);
    }
    if (contentLength) {
      res.setHeader(\'Content-Length\', contentLength);
    }
    if (acceptRanges) {
      res.setHeader(\'Accept-Ranges\', acceptRanges);
    }
    if (contentRange) {
      res.setHeader(\'Content-Range\', contentRange);
    }

    res.status(response.status);
    response.body.pipe(res);

  } catch (error) {
    console.error(\'Erro no proxy de vídeo:\', error);
    res.status(500).json({
      error: \'Erro interno do servidor\',
      details: error.message
    });
  }
});

// Rota padrão para a raiz, se necessário
app.get(\'/\', (req, res) => {
  res.send(\'Proxy de vídeo está funcionando! Use /api/proxy?url=URL_DO_VIDEO\');
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
