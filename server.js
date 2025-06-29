// Importa o framework Express
const express = require("express");

// Cria uma instância do aplicativo Express
const app = express();

// Define a porta do servidor, usando a variável de ambiente PORT (usado por serviços como o Render) ou a porta 3000 como padrão
const PORT = process.env.PORT || 3000;

// Middleware para habilitar CORS (Cross-Origin Resource Sharing)
// Isso permite que seu proxy seja acessado por aplicações web de outros domínios
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // Permite qualquer origem
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
  
  // O navegador envia uma requisição OPTIONS (preflight) para verificar as permissões de CORS
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Rota de proxy principal
app.get("/api/proxy", async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).json({ error: "URL parameter is missing" });
  }

  console.log(`Recebida requisição de proxy para: ${url}`);

  try {
    // Copia os cabeçalhos da requisição original, exceto alguns que podem causar problemas
    const headers = {};
    for (const key in req.headers) {
      if (key !== "host" && key !== "connection" && key !== "accept-encoding") {
        headers[key] = req.headers[key];
      }
    }

    // Faz a requisição para a URL de destino
    const response = await fetch(url, { headers: headers });

    // Loga o status da resposta do servidor de destino
    console.log(`Servidor de destino (${url}) respondeu com status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`Erro do servidor de destino: Status ${response.status} ${response.statusText} para a URL ${url}`);
      // Se a resposta não for OK, tenta ler como texto para mais detalhes
      const errorText = await response.text();
      throw new Error(`O servidor de destino respondeu com o status: ${response.status} ${response.statusText}. Detalhes: ${errorText}`);
    }

    // Repassa todos os cabeçalhos da resposta de destino para a nossa resposta,
    // exceto 'content-encoding' para evitar problemas de decodificação no navegador.
    response.headers.forEach((value, name) => {
      if (name.toLowerCase() !== "content-encoding") {
        res.setHeader(name, value);
      }
    });

    // Define o status da nossa resposta para ser o mesmo da resposta de destino
    res.status(response.status);

    // Tenta ler o corpo da resposta como texto
    const responseText = await response.text();

    try {
      // Tenta parsear o texto como JSON
      const json = JSON.parse(responseText);
      res.json(json); // Se for JSON válido, envia como JSON
    } catch (e) {
      // Se não for JSON válido, envia o texto puro
      res.send(responseText); 
    }

  } catch (error) {
    // Em caso de erro (falha de rede, erro do servidor de destino, etc.)
    console.error("Erro no proxy (detalhes):", error);
    res.status(500).json({
      error: "Falha ao processar a requisição de proxy.",
      details: error.message,
      fullError: error.toString() // Adiciona o erro completo para mais detalhes
    });
  }
});

// Rota raiz para uma verificação rápida se o servidor está no ar
app.get("/", (req, res) => {
  res.send("Servidor proxy está funcionando. Use a rota /api/proxy?url=URL_DO_VIDEO para usá-lo.");
});

// Inicia o servidor e o faz "escutar" por requisições na porta definida
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
