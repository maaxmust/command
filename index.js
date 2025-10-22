const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;
const apiKey = 'c335251d781d377a5c8e9c94e3ea7c10'; // Dein OpenWeatherMap-Key

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
// Großschreibt und korrigiert Umlaute
function normalizeCityName(city) {
    if (!city || typeof city !== 'string') return city;
    const map = { 'ae':'ä','oe':'ö','ue':'ü','Ae':'Ä','Oe':'Ö','Ue':'Ü','ss':'ß' };
    let normalized = city;
    for (const [k,v] of Object.entries(map)) normalized = normalized.replace(new RegExp(k,'g'), v);
    return normalized.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// Alle realistischen Wetterbeschreibungen mit Emojis
function getWeatherEmoji(description) {
    const text = description.toLowerCase();
    const map = [
        { keywords:['clear','sonnig','klar'], emoji:'☀️ Sonnig' },
        { keywords:['few clouds','leicht bewölkt'], emoji:'🌤️ Leicht bewölkt' },
        { keywords:['scattered clouds','vereinzelte wolken'], emoji:'🌥️ Vereinzelte Wolken' },
        { keywords:['broken clouds','stark bewölkt'], emoji:'☁️ Stark bewölkt' },
        { keywords:['overcast clouds','bedeckt'], emoji:'☁️ Bedeckt' },
        { keywords:['mist','nebel','dunst'], emoji:'🌫️ Neblig' },
        { keywords:['smoke','rauch'], emoji:'💨 Rauchig' },
        { keywords:['haze','dunstig'], emoji:'🌫️ Dunstig' },
        { keywords:['sand','dust','staub'], emoji:'🏜️ Staubig' },
        { keywords:['volcanic ash','vulkanasche'], emoji:'🌋 Vulkanasche' },
        { keywords:['squalls','böen'], emoji:'🌬️ Böig' },
        { keywords:['tornado'], emoji:'🌪️ Tornado' },
        { keywords:['drizzle','nieselregen'], emoji:'🌦️ Nieselregen' },
        { keywords:['light rain','leichter regen'], emoji:'🌦️ Leichter Regen' },
        { keywords:['moderate rain','mäßiger regen'], emoji:'🌧️ Mäßiger Regen' },
        { keywords:['heavy intensity rain','starker regen'], emoji:'🌧️ Starker Regen' },
        { keywords:['very heavy rain','sehr starker regen'], emoji:'🌧️ Sehr starker Regen' },
        { keywords:['extreme rain','extremer regen'], emoji:'🌧️ Extrem starker Regen' },
        { keywords:['freezing rain','gefrierender regen'], emoji:'🌨️ Gefrierender Regen' },
        { keywords:['shower rain','schauer'], emoji:'🌧️ Schauer' },
        { keywords:['light snow','leichter schnee'], emoji:'❄️ Leichter Schnee' },
        { keywords:['snow','schnee'], emoji:'❄️ Schnee' },
        { keywords:['heavy snow','starker schnee'], emoji:'❄️ Starker Schnee' },
        { keywords:['sleet','schneeregen'], emoji:'🌨️ Schneeregen' },
        { keywords:['shower sleet','schneeschauer'], emoji:'🌨️ Schneeschauer' },
        { keywords:['rain and snow','regen und schnee'], emoji:'🌨️ Regen und Schnee' },
        { keywords:['thunderstorm','gewitter'], emoji:'⛈️ Gewitter' },
        { keywords:['thunderstorm with rain','gewitter mit regen'], emoji:'⛈️ Gewitter mit Regen' },
        { keywords:['thunderstorm with lightning','gewitter mit blitz'], emoji:'⛈️ Gewitter mit Blitz' },
        { keywords:['wind','windig'], emoji:'🌬️ Windig' },
        { keywords:['storm','orkan'], emoji:'🌪️ Sturm' },
        { keywords:['rainbow','regenbogen'], emoji:'🌈 Regenbogen' }
    ];
    for (const item of map) {
        for (const kw of item.keywords) if (text.includes(kw)) return item.emoji;
    }
    return '🌈 Unbekanntes Wetter';
}

// Temperaturbeschreibung mit Emojis
function getTemperatureDescription(tempC) {
    if (tempC >= 35) return '🥵 Sehr heiß';
    if (tempC >= 30) return '🔥 Heiß';
    if (tempC >= 25) return '🌞 Warm';
    if (tempC >= 20) return '😎 Angenehm';
    if (tempC >= 15) return '🌤️ Mild';
    if (tempC >= 10) return '🧥 Frisch';
    if (tempC >= 5) return '🧊 Kühl';
    if (tempC >= 0) return '❄️ Kalt';
    return '🥶 Sehr kalt';
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

// Weather Route
app.get('/weather', (req, res) => {
    res.send('Bitte gib eine Stadt an, z. B. /weather/Berlin oder /weather/New York');
});

app.get('/weather/:city', async (req, res) => {
    const rawCity = req.params.city;
    const displayCity = normalizeCityName(rawCity);
    const encodedCity = encodeURIComponent(rawCity);

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodedCity}&appid=${apiKey}&units=metric&lang=de`,
            { signal: controller.signal }
        );

        clearTimeout(timeout);

        const weather = response.data;
        const tempC = Math.round(weather.main.temp);
        const description = weather.weather[0].description;
        const weatherText = getWeatherEmoji(description);
        const tempText = getTemperatureDescription(tempC);

        res.send(`In ${displayCity} ist es aktuell ${tempC}°C (${weatherText}, ${tempText})`);
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
