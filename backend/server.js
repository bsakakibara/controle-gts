const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3008;
const path = require('path');
const fs = require('fs');

// Caminho relativo para o banco de dados
const dbPath = path.join(__dirname, 'banco_de_dados.db');

// Conectar ao banco de dados SQLite
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite');

        // Habilitar o modo WAL para evitar bloqueios
        db.run('PRAGMA journal_mode = WAL;');

        // Criar a tabela se não existir
        db.run(`CREATE TABLE IF NOT EXISTS entrada (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pessoa TEXT NOT NULL,
            descricao TEXT NOT NULL,
            valor REAL NOT NULL
        )`, (err) => {
            if (err) {
                console.error('Erro ao criar tabela:', err.message);
            } else {
                console.log('Tabela "entrada" verificada ou criada com sucesso.');
            }
        });

        // Criar a tabela se não existir
        db.run(`CREATE TABLE IF NOT EXISTS despesa (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pessoa TEXT NOT NULL,
            descricao TEXT NOT NULL,
            valor REAL NOT NULL,
            tipoDespesa TEXT DEFAULT 'variável',
            vencimento DATE NOT NULL
        )`, (err) => {
            if (err) {
                console.error('Erro ao criar tabela:', err.message);
            } else {
                console.log('Tabela "despesa" verificada ou criada com sucesso.');
            }
        });
    }
});

app.use(express.json());
app.use(cors({ origin: '*' }));

// Rota para listar as entradas
app.get('/api/entrada', (req, res) => {
    console.log('Requisição recebida para listar entradas.');
    db.all('SELECT * FROM entrada', (err, rows) => {
        if (err) {
            console.error('Erro ao buscar entradas:', err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`Entradas retornadas: ${rows.length} entradas encontradas.`);
        res.json(rows);
    });
});

// Rota para listar as despesas
app.get('/api/despesa', (req, res) => {
    console.log('Requisição recebida para listar despesas.');
    db.all('SELECT * FROM despesa', (err, rows) => {
        if (err) {
            console.error('Erro ao buscar despesas:', err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`Despesas retornadas: ${rows.length} Despesas encontradas.`);
        res.json(rows);
    });
});

// Rota para adicionar uma entrada
app.post('/api/entrada', (req, res) => {
    const { pessoa, descricao, valor } = req.body;
    console.log('Dados recebidos para adicionar entrada:', { pessoa, descricao, valor });

    db.serialize(() => {
        db.run('INSERT INTO entrada (pessoa, descricao, valor) VALUES (?, ?, ?)',
            [pessoa, descricao, valor],
            function (err) {
                if (err) {
                    console.error('Erro ao inserir no banco:', err.message);
                    return res.status(500).json({ error: err.message });
                }
                console.log(`Entrada inserida com sucesso: ID ${this.lastID}`);
                res.json({ id: this.lastID });
            }
        );
    });
});

// Rota para adicionar uma despesa
app.post('/api/despesa', (req, res) => {
    const { pessoa, descricao, valor, tipoDespesa, vencimento } = req.body;
    console.log('Dados recebidos para adicionar despesa:', { pessoa, descricao, valor, tipoDespesa, vencimento });

    if (!vencimento) {
        return res.status(400).json({ message: 'A data de vencimento é obrigatória.' });
    }

    db.serialize(() => {
        db.run('INSERT INTO despesa (pessoa, descricao, valor, tipoDespesa, vencimento) VALUES (?, ?, ?, ?, ?)',
            [pessoa, descricao, valor, tipoDespesa || 'variável', vencimento],
            function (err) {
                if (err) {
                    console.error('Erro ao inserir no banco:', err.message);
                    return res.status(500).json({ error: err.message });
                }
                console.log(`Despesa inserida com sucesso: ID ${this.lastID}`);
                res.json({ id: this.lastID });
            }
        );
    });
});

// Rota para editar uma entrada
app.put('/api/entrada/:id', (req, res) => {
    const { id } = req.params;
    const { descricao, valor } = req.body;

    console.log(`Requisição recebida para editar entrada com ID: ${id}`);
    if (!descricao || !valor) {
        console.log('Erro: Descrição e valor são obrigatórios.');
        return res.status(400).json({ message: 'Descrição e valor são obrigatórios' });
    }

    db.run(
        'UPDATE entrada SET descricao = ?, valor = ? WHERE id = ?',
        [descricao, valor, id],
        function (err) {
            if (err) {
                console.error('Erro ao atualizar entrada:', err.message);
                return res.status(500).json({ message: 'Erro ao atualizar entrada' });
            }

            if (this.changes === 0) {
                console.log(`Entrada com ID ${id} não encontrada.`);
                return res.status(404).json({ message: 'Entrada não encontrada' });
            }

            console.log(`Entrada com ID ${id} atualizada com sucesso.`);
            res.json({ message: 'Entrada de valores atualizada com sucesso' });
        }
    );
});

// Rota para editar uma despesa
app.put('/api/despesa/:id', (req, res) => {
    const { id } = req.params;
    const { descricao, valor, tipoDespesa } = req.body;

    console.log(`Requisição recebida para editar despesa com ID: ${id}`);
    if (!descricao || !valor || !tipoDespesa) {
        console.log('Erro: Todos os campos são obrigatórios.');
        return res.status(400).json({ message: 'Descrição, valor e tipo de despesa são obrigatórios' });
    }

    db.run(
        'UPDATE despesa SET descricao = ?, valor = ?, tipoDespesa = ? WHERE id = ?',
        [descricao, valor, tipoDespesa, id],
        function (err) {
            if (err) {
                console.error('Erro ao atualizar despesa:', err.message);
                return res.status(500).json({ message: 'Erro ao atualizar despesa' });
            }

            if (this.changes === 0) {
                console.log(`Despesa com ID ${id} não encontrada.`);
                return res.status(404).json({ message: 'Despesa não encontrada' });
            }

            console.log(`Despesa com ID ${id} atualizada com sucesso.`);
            res.json({ message: 'Despesa atualizada com sucesso' });
        }
    );
});

// Rota para excluir uma entrada
app.delete('/api/entrada/:id', (req, res) => {
    const { id } = req.params;
    console.log(`Tentando excluir a entrada com ID: ${id}`);

    db.run('DELETE FROM entrada WHERE id = ?', [id], function (err) {
        if (err) {
            console.error('Erro ao excluir a entrada:', err.message);
            return res.status(500).json({ error: err.message });
        }
        http://localhost:5173/editar-despesa
        if (this.changes === 0) {
            console.log(`Entrada com ID ${id} não encontrada para exclusão.`);
            return res.status(404).json({ message: 'Entrada de valores não encontrada' });
        } Debug

        console.log(`Entrada com ID ${id} excluída com sucesso.`);
        res.status(200).json({ message: 'Entrada de valores excluída com sucesso' });
    });
});

// Rota para excluir uma despesa
app.delete('/api/despesa/:id', (req, res) => {
    const { id } = req.params;
    console.log(`Tentando excluir a despesa com ID: ${id}`);

    db.run('DELETE FROM despesa WHERE id = ?', [id], function (err) {
        if (err) {
            console.error('Erro ao excluir a despesa:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (this.changes === 0) {
            console.log(`Despesa com ID ${id} não encontrada para exclusão.`);
            return res.status(404).json({ message: 'Despesa de valores não encontrada' });
        }

        console.log(`Despesa com ID ${id} excluída com sucesso.`);
        res.status(200).json({ message: 'Despesa de valores excluída com sucesso' });
    });
});

console.log(process.env);
// Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});