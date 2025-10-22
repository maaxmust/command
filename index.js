const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;
const apiKey = '9f2a7dab0d2248f89aa23315252802'; // Wetter-API-Key direkt im Code

app.use(cors());

/* ---------------- NUTZLOS-COMMAND ---------------- */
function generateDailyValue(username) {
    const today = new Date().toISOString().split('T')[0];
    const normalizedUsername = username.toLowerCase();
    const seed = `${normalizedUsername}-${today}`;

    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
    }

    return Math.abs(hash % 100) + 1;
}

app.get('/nutzlos/:username', (req, res) => {
    const username = req.params.username;
    const value = generateDailyValue(username);
    res.send(`${username}, du bist heute zu ${value}% nutzlos 🥸`);
});

/* ---------------- WETTER-COMMAND ---------------- */
// Großschreibt jedes Wort + korrigiert deutsche Umlaute
function normalizeCityName(city) {
    if (!city || typeof city !== 'string') return city;

    const map = {
        'ae': 'ä',
        'oe': 'ö',
        'ue': 'ü',
        'Ae': 'Ä',
        'Oe': 'Ö',
        'Ue': 'Ü',
        'ss': 'ß'
    };

    let normalized = city;
    for (const [key, value] of Object.entries(map)) {
        const regex = new RegExp(key, 'g');
        normalized = normalized.replace(regex, value);
    }

    return normalized
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

function getWeatherEmoji(description) {
    const text = description.toLowerCase();

    if (text.includes('klar') || text.includes('sonnig') || text.includes('clear')) return '☀️ Klarer Himmel';
    if (text.includes('leicht bewölkt') || text.includes('partly cloudy')) return '🌤️ Leicht bewölkt';
    if ((text.includes('bewölkt') && !text.includes('stark')) || text.includes('cloudy')) return '🌥️ Bewölkt';
    if (text.includes('stark bewölkt') || text.includes('overcast')) return '☁️ Stark bewölkt';
    if (text.includes('bedeckt')) return '☁️ Bedeckt';
    if (text.includes('nebel') || text.includes('dunst') || text.includes('fog') || text.includes('mist')) return '🌫️ Nebel';
    
    if (text.includes('regen') && !text.includes('gewitter')) return '🌧️ Regen';
    if (text.includes('nieselregen') || text.includes('drizzle')) return '🌦️ Nieselregen';
    if (text.includes('schneeregen') || text.includes('graupel') || text.includes('hail')) return '🌨️ Schneeregen';
    
    if (text.includes('schnee') || text.includes('neuschnee') || text.includes('snow')) return '❄️ Schnee';
    
    if (text.includes('gewitter') || text.includes('blitz') || text.includes('thunder')) return '⛈️ Gewitter';
    
    if (text.includes('wind') || text.includes('breeze') || text.includes('gust')) return '🌬️ Windig';
    if (text.includes('sturm') || text.includes('orkan') || text.includes('storm')) return '🌪️ Sturm';
    
    if (text.includes('regenbogen')) return '🌈 Regenbogen';

    return '🌈 Unbekanntes Wetter';
}

// Sympathische Fehlertexte
function getRandomError(city) {
    const errorMessages = [
        `🛸 Hm… Irgendwas stimmt nicht mit ${city}, vielleicht ein Tippfehler? 🤔`,
        `🙃 Ups! Ich finde ${city} gerade nicht, vielleicht ein Tippfehler? 🤔`,
        `😅 Oh nein, ${city} existiert nicht… vielleicht falsch geschrieben?`,
        `🤖 Hm… ${city} will mir keine Wetterdaten geben. Noch ein Versuch?`,
        `🤷‍♂️ Hm, ${city} scheint nicht zu existieren. Vielleicht ein Tippfehler?`
    ];
    return errorMessages[Math.floor(Math.random() * errorMessages.length)];
}

app.get('/weather', (req, res) => {
    res.send('Bitte gib eine Stadt an, z. B. /weather/Berlin');
});

app.get('/weather/:city', async (req, res) => {
    const rawCity = req.params.city;
    const displayCity = normalizeCityName(rawCity);
    const encodedCity = encodeURIComponent(rawCity);

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await axios.get(
            `http://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodedCity}&lang=de`,
            { signal: controller.signal }
        );

        clearTimeout(timeout);

        const weather = response.data.current;
        const description = weather.condition.text;
        const tempC = weather.temp_c;
        const emojiText = getWeatherEmoji(description);

        res.send(`In ${displayCity} ist es aktuell ${tempC}°C (${emojiText})`);
    } catch (error) {
        clearTimeout(timeout);
        res.send(getRandomError(displayCity));
    }
});

/* ---------------- ROOT ---------------- */
app.get('/', (req, res) => {
    res.send('✅ API läuft! Verwende /nutzlos/DEIN_NAME oder /weather/STADT');
});

/* ---------------- START ---------------- */
app.listen(port, () => {
    console.log(`🚀 Server läuft auf Port ${port}`);
});
