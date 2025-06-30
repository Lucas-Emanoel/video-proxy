const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

app.get('/api/proxy', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({
      error: 'O parâmetro "url" é obrigatório.',
      usage: 'Use: /api/proxy?url=URL_DO_VIDEO'
    });
  }

  console.log(`Recebida requisição de proxy para: ${url}`);

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };

    if (req.headers.range) {
      headers['Range'] = req.headers.range;
      console.log(`Repassando header Range: ${req.headers.range}`);
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (e) {
        errorBody = 'Não foi possível ler o corpo da resposta de erro';
      }
      
      console.error(`Erro do servidor de destino: Status ${response.status} ${response.statusText} para a URL ${url}`);
      console.error(`Corpo da resposta de erro: ${errorBody}`);
      
      throw new Error(`O servidor de destino respondeu com o status: ${response.status} ${response.statusText}. Detalhes: ${errorBody}`);
    }

    console.log(`Servidor de destino (${url}) respondeu com status: ${response.status} ${response.statusText}`);

    res.status(response.status);

    response.headers.forEach((value, name) => {
      res.setHeader(name, value);
    });

    response.body.pipe(res);

  } catch (error) {
    console.error('Erro no proxy (detalhes):', error);
    res.status(500).json({
      error: 'Falha ao processar a requisição de proxy.',
      details: error.message
    });
  }
});

app.get('/', (req, res) => {
  res.send('Servidor proxy está funcionando. Use a rota /api/proxy?url=URL_DO_VIDEO para usá-lo.');
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

