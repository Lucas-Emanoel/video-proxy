// index.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Habilita CORS para todas as origens. Em produção, restrinja para o seu domínio.
app.use(cors({ origin: '*' }));

// Rota de "saúde" para verificar se o servidor está no ar
app.get('/', (req, res) => {
    res.send('Servidor Proxy AtennaFlix está no ar!');
});

// A rota principal do proxy
app.get('/play', async (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl) {
    return res.status(400).send('URL do vídeo não fornecida.');
  }

  console.log(`Recebida requisição de proxy para: ${videoUrl}`);

  try {
    // Faz a requisição ao servidor de vídeo para receber um stream
    const response = await axios({
      method: 'get',
      url: videoUrl,
      responseType: 'stream',
      // Repassa o cabeçalho Range para permitir avançar/retroceder no vídeo
      headers: {
        'Range': req.headers.range || 'bytes=0-'
      }
    });

    // Repassa os cabeçalhos da resposta original (Content-Type, Content-Length, etc.)
    res.writeHead(response.status, response.headers);

    // Usa .pipe() para transmitir o vídeo diretamente para o cliente.
    // Para axios, o stream está em `response.data`.
    response.data.pipe(res);

  } catch (error) {
    console.error(`Erro no proxy para ${videoUrl}:`, error.message);
    res.status(error.response?.status || 500).send('Erro ao buscar o vídeo via proxy.');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor proxy rodando na porta ${PORT}`);
});