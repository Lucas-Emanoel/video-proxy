// Importa o framework Express
const express = require('express');

// Cria uma instância do aplicativo Express
const app = express();

// Define a porta do servidor, usando a variável de ambiente PORT (usado por serviços como o Render) ou a porta 3000 como padrão
const PORT = process.env.PORT || 3000;

// Middleware para habilitar CORS (Cross-Origin Resource Sharing)
// Isso permite que seu proxy seja acessado por aplicações web de outros domínios
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // Permite qualquer origem
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  
  // O navegador envia uma requisição OPTIONS (preflight) para verificar as permissões de CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Rota principal do proxy
// Exemplo de uso: /api/proxy?url=https://exemplo.com/video.mp4
app.get('/api/proxy', async (req, res ) => {
  // Pega a URL do vídeo a partir dos parâmetros da query
  const { url } = req.query;

  // Validação: verifica se a URL foi fornecida
  if (!url) {
    return res.status(400).json({
      error: 'O parâmetro "url" é obrigatório.',
      usage: 'Use: /api/proxy?url=URL_DO_VIDEO'
    });
  }

  console.log(`Recebida requisição de proxy para: ${url}`);

  try {
    // Monta os cabeçalhos para a requisição externa
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };

    // Se a requisição original do cliente incluir um cabeçalho 'Range' (para streaming de vídeo),
    // nós o repassamos para a requisição final.
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
      console.log(`Repassando header Range: ${req.headers.range}`);
    }

    // Usa a função fetch nativa do Node.js para buscar o conteúdo da URL
    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });

    // Se a resposta do servidor de destino não for bem-sucedida (ex: 404, 500), lança um erro.
    if (!response.ok) {
      console.error(`Erro do servidor de destino: Status ${response.status} ${response.statusText} para a URL ${url}`);
      throw new Error(`O servidor de destino respondeu com o status: ${response.status} ${response.statusText}`);
    }

    // Define o status da nossa resposta para ser o mesmo da resposta de destino (importante para o 'Range' - 206 Partial Content)
    res.status(response.status);

    // Repassa todos os cabeçalhos da resposta de destino para a nossa resposta.
    // Isso é mais robusto do que copiar um por um.
    response.headers.forEach((value, name) => {
      res.setHeader(name, value);
    });

    // Envia o corpo da resposta de destino (o vídeo) para o cliente.
    // O método .pipe() faz isso de forma eficiente, sem carregar o vídeo inteiro na memória.
    response.body.pipe(res);

  } catch (error) {
    // Em caso de erro (falha de rede, erro do servidor de destino, etc.)
    console.error('Erro no proxy (detalhes):', error);
    res.status(500).json({
      error: 'Falha ao processar a requisição de proxy.',
      details: error.message,
      fullError: error.toString() // Adiciona o erro completo para mais detalhes
    });
  }
});

// Rota raiz para uma verificação rápida se o servidor está no ar
app.get('/', (req, res) => {
  res.send('Servidor proxy está funcionando. Use a rota /api/proxy?url=URL_DO_VIDEO para usá-lo.');
});

// Inicia o servidor e o faz "escutar" por requisições na porta definida
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
