const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Plik do przechowywania wyników
const RESULTS_FILE = path.join(__dirname, 'results.json');

// Serwowanie plików z folderu public
app.use(express.static(path.join(__dirname, 'public')));

// Funkcja ładująca wyniki z pliku
function loadResults() {
    try {
        if (fs.existsSync(RESULTS_FILE)) {
            const data = fs.readFileSync(RESULTS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Błąd podczas ładowania wyników:', err);
    }
    return [];
}

// Funkcja zapisująca wyniki do pliku
function saveResults(results) {
    try {
        fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    } catch (err) {
        console.error('Błąd podczas zapisywania wyników:', err);
    }
}

let studentsResults = loadResults();

// Endpoint dla klienta, aby dowiedział się jaki jest adres IP serwera
app.get('/api/config', (req, res) => {
    res.json({ ip: getLocalIP(), port: PORT });
});

// ENDPOINT DO POBIERANIA WYNIKÓW - To tutaj pobierzesz plik!
app.get('/download-results', (req, res) => {
    if (fs.existsSync(RESULTS_FILE)) {
        res.download(RESULTS_FILE);
    } else {
        res.status(404).send('Brak wyników do pobrania.');
    }
});

io.on('connection', (socket) => {
    console.log('Nowe połączenie!');

    socket.on('submitScore', (data) => {
        const existingIndex = studentsResults.findIndex(s => s.name === data.name);
        if (existingIndex !== -1) {
            studentsResults[existingIndex].score = data.score;
        } else {
            studentsResults.push({ name: data.name, score: data.score });
        }
        saveResults(studentsResults); // Zapisz po każdym nowym wyniku!
        io.emit('updateTeacherList', studentsResults);
    });

    socket.on('getTop3', () => {
        const top3 = [...studentsResults]
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
        io.emit('showTop3', top3);
    });

    socket.on('resetQuiz', () => {
        studentsResults = [];
        saveResults(studentsResults); // Wyczyść też plik!
        io.emit('updateTeacherList', []);
    });
});

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (let devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
    console.log('==============================================');
    console.log(`✅ APLIKACJA GOTOWA!`);
    console.log(`----------------------------------------------`);
    console.log(`📱 DLA UCZNIÓW (QR): http://${getLocalIP()}:${PORT}`);
    console.log(`🖥️  DLA NAUCZYCIELA: http://localhost:${PORT}/teacher.html`);
    console.log(`📥 POBIERANIE WYNIKÓW: http://${getLocalIP()}:${PORT}/download-results`);
    console.log('==============================================');
});
