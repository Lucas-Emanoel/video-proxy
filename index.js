// index.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
// O Render define a porta através da variável de ambiente PORT
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' })); // Para produção, restrinja a origem

app.get('/', (req, res) => {
    res.send('Servidor Proxy de Vídeo está no ar! Use o endpoint /play?url=...');
});

app.get('/play', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).send('URL do vídeo não fornecida.');
  }
  try {
    const response = await axios({
      method: 'get',
      url: videoUrl,
      responseType: 'stream',
      headers: { 'Range': req.headers.range || 'bytes=0-' }
    });
    res.writeHead(response.status, response.headers);
    response.data.pipe(res);
  } catch (error) {
    console.error('Erro no proxy:', error.message);
    res.status(error.response?.status || 500).send('Erro ao buscar o vídeo.');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor proxy rodando na porta ${PORT}`);
});