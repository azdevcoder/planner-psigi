const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Configurações do GitHub extraídas das Variáveis de Ambiente do Render
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Seu Personal Access Token (PAT)
const REPO_OWNER = process.env.REPO_OWNER;     // Seu usuário do GitHub
const REPO_NAME = process.env.REPO_NAME;       // Nome do repositório do backend
const FILE_PATH = 'db.json';                   // Nome do arquivo de banco de dados

// Função auxiliar para se comunicar com a API do GitHub
async function gitHubFetch(method, body = null, sha = null) {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const headers = {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'NodeJS-Backend'
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    return response;
}

// Ler dados do GitHub
async function readDatabase() {
    try {
        const res = await gitHubFetch('GET');
        if (res.status === 404) return { data: [], sha: null }; // Se não existir, retorna vazio
        
        const json = await res.json();
        const content = Buffer.from(json.content, 'base64').toString('utf-8');
        return { data: JSON.parse(content), sha: json.sha };
    } catch (err) {
        console.error("Erro ao ler banco do GitHub:", err);
        return { data: [], sha: null };
    }
}

// Gravar dados no GitHub (Gera um commit automático)
async function writeDatabase(newData, sha) {
    const contentBase64 = Buffer.from(JSON.stringify(newData, null, 2)).toString('base64');
    const body = {
        message: 'database update via planner API',
        content: contentBase64,
        sha: sha // Necessário para atualizar arquivos existentes
    };
    await gitHubFetch('PUT', body);
}

// ==================== ROTAS CRUD ====================

// READ
app.get('/tasks', async (req, res) => {
    const { data } = await readDatabase();
    res.json(data);
});

// CREATE (Atualizado no seu server.js)
app.post('/tasks', async (req, res) => {
    const { text, day, category } = req.body; // Adicionado 'category' aqui
    const { data, sha } = await readDatabase();

    // O objeto agora salva a categoria correspondente à cor
    const newTask = { 
        id: Date.now().toString(), 
        text, 
        day, 
        category: category || 'atendimentos', 
        completed: false 
    };
    
    data.push(newTask);

    await writeDatabase(data, sha);
    res.status(201).json(newTask);
});

// UPDATE
app.put('/tasks/:id', async (req, res) => {
    const { id } = req.params;
    const { text, day, completed } = req.body;
    const { data, sha } = await readDatabase();

    let task = data.find(t => t.id === id);
    if (!task) return res.status(404).json({ error: "Tarefa não encontrada" });

    if (text !== undefined) task.text = text;
    if (day !== undefined) task.day = day;
    if (completed !== undefined) task.completed = completed;

    await writeDatabase(data, sha);
    res.json(task);
});

// DELETE
app.delete('/tasks/:id', async (req, res) => {
    const { id } = req.params;
    const { data, sha } = await readDatabase();

    const filteredData = data.filter(t => t.id !== id);

    await writeDatabase(filteredData, sha);
    res.status(204).send();
});

app.listen(PORT, () => {
    console.log(`Servidor rodando e integrado ao GitHub na porta ${PORT}`);
});