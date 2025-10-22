const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

const weatherApiKey = 'c335251d781d377a5c8e9c94e3ea7c10'; // OpenWeatherMap
const nasaApiKey = 'ucqtnncar4FshdBUccRh56isBbcIdAmJqpZea5VO'; // NASA API

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

/* ---------------- HELPER FUNCTIONS ---------------- */
function normalizeCityName(city) {
    if (!city || typeof city !== 'string') return city;

    const map = { 'ae':'ä','oe':'ö','ue':'ü','Ae':'Ä','Oe':'Ö','Ue':'Ü','ss':'ß' };
    let normalized = city;
    for (const [key,value] of Object.entries(map)) {
        const regex = new RegExp(key,'g');
        normalized = normalized.replace(regex,value);
    }

    return normalized.trim().split(' ')
        .map(word => word.charAt(0).toUpperCase()+word.slice(1).toLowerCase())
        .join(' ');
}

// Alle gängigen OpenWeatherMap-Beschreibungen inkl. feiner Zustände
function getWeatherEmoji(description) {
    if (!description) return '';
    const text = description.toLowerCase();

    const map = [
        { keywords: ['klar','sonnig','sunny'], emoji:'☀️ Sonnig' },
        { keywords: ['leicht bewölkt','few clouds'], emoji:'🌤️ Leicht bewölkt' },
        { keywords: ['wolkenfelder','scattered clouds'], emoji:'🌥️ Bewölkt' },
        { keywords: ['gebrochene wolken','broken clouds'], emoji:'☁️ Stark bewölkt' },
        { keywords: ['bedeckt','überwiegend bewölkt','overcast clouds'], emoji:'☁️ Bedeckt' },
        { keywords: ['leichter regen','light rain','drizzle'], emoji:'🌦️ Leichter Regen' },
        { keywords: ['mäßiger regen','moderate rain'], emoji:'🌧️ Mäßiger Regen' },
        { keywords: ['starker regen','heavy intensity rain'], emoji:'🌧️ Starker Regen' },
        { keywords: ['sehr starker regen','very heavy rain'], emoji:'🌧️ Sehr starker Regen' },
        { keywords: ['extremer regen','extreme rain'], emoji:'🌧️ Extrem starker Regen' },
        { keywords: ['gefriereneder regen','freezing rain'], emoji:'🌨️ Gefrierender Regen' },
        { keywords: ['leichter schnee','light snow'], emoji:'❄️ Leichter Schnee' },
        { keywords: ['schnee','snow'], emoji:'❄️ Schnee' },
        { keywords: ['starker schnee','heavy snow'], emoji:'❄️ Starker Schnee' },
        { keywords: ['schneeregen','sleet'], emoji:'🌨️ Schneeregen' },
        { keywords: ['schneeschauer','shower snow'], emoji:'🌨️ Schneeschauer' },
        { keywords: ['leichtes gewitter','light thunderstorm'], emoji:'⛈️ Leichtes Gewitter' },
        { keywords: ['gewitter','thunderstorm'], emoji:'⛈️ Gewitter' },
        { keywords: ['starkes gewitter','heavy thunderstorm'], emoji:'⛈️ Starkes Gewitter' },
        { keywords: ['unregelmäßiges gewitter','ragged thunderstorm'], emoji:'⛈️ Unregelmäßiges Gewitter' },
        { keywords: ['gewitter mit leichtem regen','thunderstorm with light rain'], emoji:'⛈️ Gewitter mit leichtem Regen' },
        { keywords: ['gewitter mit regen','thunderstorm with rain'], emoji:'⛈️ Gewitter mit Regen' },
        { keywords: ['gewitter mit starkem regen','thunderstorm with heavy rain'], emoji:'⛈️ Gewitter mit starkem Regen' },
        { keywords: ['gewitter mit nieselregen','thunderstorm with drizzle'], emoji:'⛈️ Gewitter mit Nieselregen' },
        { keywords: ['nebel','fog','mist','dunst'], emoji:'🌫️ Nebel' },
        { keywords: ['rauch','smoke'], emoji:'💨 Rauch' },
        { keywords: ['sand'], emoji:'🏜️ Sandig' },
        { keywords: ['staub','dust'], emoji:'💨 Staubig' },
        { keywords: ['vulkanasche','volcanic ash'], emoji:'🌋 Vulkanasche' },
        { keywords: ['böen','squalls'], emoji:'🌬️ Böen' },
        { keywords: ['tornado'], emoji:'🌪️ Tornado' },
        { keywords: ['wind','breeze','gust'], emoji:'🌬️ Windig' },
        { keywords: ['sturm','orkan','storm'], emoji:'🌪️ Sturm' },
        { keywords: ['regenbogen'], emoji:'🌈 Regenbogen' },
        { keywords: ['leichter schauer','light shower rain'], emoji:'🌦️ Leichter Schauer' },
        { keywords: ['schauerregen','shower rain'], emoji:'🌧️ Schauerregen' },
        { keywords: ['starker schauer','heavy intensity shower rain'], emoji:'🌧️ Starker Schauer' },
        { keywords: ['unregelmäßiger schauer','ragged shower rain'], emoji:'🌧️ Unregelmäßiger Schauer' }
    ];

    for (const item of map) {
        for (const kw of item.keywords) {
            if (text.includes(kw)) return item.emoji;
        }
    }
    return ''; // kein Emoji wenn unbekannt
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

// Sympathische Fehlertexte bei Tippfehlern
function getRandomError(city) {
    const errorMessages = [
        `🛸 Hm… Irgendwas stimmt nicht mit "${city}", vielleicht ein Tippfehler? 🤔`,
        `🙃 Ups! Ich finde "${city}" gerade nicht, vielleicht falsch geschrieben? 🤔`,
        `😅 Oh nein, "${city}" existiert nicht…`,
        `🤖 "${city}" will mir keine Wetterdaten geben. Noch ein Versuch?`,
        `🤷‍♂️ Hm, "${city}" scheint nicht zu existieren.`
    ];
    return errorMessages[Math.floor(Math.random() * errorMessages.length)];
}

/* ---------------- WEATHER ROUTES ---------------- */
app.get('/weather', (req,res) => {
    res.send('Bitte gib eine Stadt oder Planeten an, z.B. /weather/Berlin oder /weather/Mars');
});

app.get('/weather/:place', async (req,res) => {
    const rawPlace = req.params.place;
    const displayPlace = normalizeCityName(rawPlace);
    const encodedPlace = encodeURIComponent(rawPlace);

    try {
        let tempC = null;
        let description = '';
        // Erde
        if (!['Sonne','Mars','Mond'].includes(displayPlace)) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodedPlace}&appid=${weatherApiKey}&units=metric&lang=de`, { signal: controller.signal });
            clearTimeout(timeout);

            temp
