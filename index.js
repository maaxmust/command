const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Keys
const openWeatherKey = 'c335251d781d377a5c8e9c94e3ea7c10'; // OpenWeatherMap
const nasaKey = 'ucqtnncar4FshdBUccRh56isBbcIdAmJqpZea5VO'; // NASA

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

/* ---------------- STADTNAME NORMALISIEREN ---------------- */
function normalizeCityName(city) {
    if (!city || typeof city !== 'string') return city;
    const map = { 'ae':'ä','oe':'ö','ue':'ü','Ae':'Ä','Oe':'Ö','Ue':'Ü','ss':'ß' };
    let normalized = city;
    for (const [key, value] of Object.entries(map)) {
        const regex = new RegExp(key,'g');
        normalized = normalized.replace(regex,value);
    }
    return normalized
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/* ---------------- WETTER-EMOJIS ---------------- */
function getWeatherEmoji(description) {
    const text = description.toLowerCase();
    const map = [
        { keywords:['klar','sonnig'], emoji:'☀️ Sonnig' },
        { keywords:['leicht bewölkt'], emoji:'🌤️ Leicht bewölkt' },
        { keywords:['bewölkt'], emoji:'🌥️ Bewölkt' },
        { keywords:['stark bewölkt','überwiegend bewölkt','bedeckt'], emoji:'☁️ Bedeckt' },
        { keywords:['leichter regen','nieselregen','drizzle'], emoji:'🌦️ Leichter Regen' },
        { keywords:['moderater regen'], emoji:'🌧️ Mäßiger Regen' },
        { keywords:['starker regen','heavy intensity rain'], emoji:'🌧️ Starker Regen' },
        { keywords:['extremer regen','very heavy rain','extreme rain'], emoji:'🌧️ Extrem starker Regen' },
        { keywords:['gefriereneder regen','freezing rain'], emoji:'🌨️ Gefrierender Regen' },
        { keywords:['leichter schnee','snow','light snow'], emoji:'❄️ Leichter Schnee' },
        { keywords:['schnee','snow'], emoji:'❄️ Schnee' },
        { keywords:['starker schnee','heavy snow'], emoji:'❄️ Starker Schnee' },
        { keywords:['schneeregen','sleet'], emoji:'🌨️ Schneeregen' },
        { keywords:['schneeschauer','shower snow'], emoji:'🌨️ Schneeschauer' },
        { keywords:['gewitter','thunderstorm'], emoji:'⛈️ Gewitter' },
        { keywords:['leichte gewitter','light thunderstorm'], emoji:'⛈️ Leichtes Gewitter' },
        { keywords:['nebel','fog','mist','dunst'], emoji:'🌫️ Nebel' },
        { keywords:['rauch','smoke'], emoji:'💨 Rauch' },
        { keywords:['sand','sandig'], emoji:'🏜️ Sandig' },
        { keywords:['staub','dust'], emoji:'💨 Staubig' },
        { keywords:['vulkanasche','volcanic ash'], emoji:'🌋 Vulkanasche' },
        { keywords:['böen','squalls'], emoji:'🌬️ Böen' },
        { keywords:['tornado'], emoji:'🌪️ Tornado' },
        { keywords:['wind','breeze','gust'], emoji:'🌬️ Windig' },
        { keywords:['sturm','orkan','storm'], emoji:'🌪️ Sturm' },
        { keywords:['regenbogen'], emoji:'🌈 Regenbogen' }
    ];

    for (const item of map) {
        for (const kw of item.keywords) {
            if (text.includes(kw)) return item.emoji;
        }
    }
    return '';
}

/* ---------------- SYMPATHISCHE FEHLERMELDUNGEN ---------------- */
function getRandomError(city) {
    const errorMessages = [
        `🛸 Hm… Irgendwas stimmt nicht mit "${city}", vielleicht ein Tippfehler? 🤔`,
        `🙃 Ups! Ich finde "${city}" gerade nicht, vielleicht ein Tippfehler? 🤔`,
        `😅 Oh nein, "${city}" existiert nicht… vielleicht falsch geschrieben?`,
        `🤖 Hm… "${city}" will mir keine Daten geben. Noch ein Versuch?`,
        `🤷‍♂️ Hm, "${city}" scheint nicht zu existieren. Vielleicht ein Tippfehler?`
    ];
    return errorMessages[Math.floor(Math.random()*errorMessages.length)];
}

/* ---------------- WEATHER COMMAND ---------------- */
app.get('/weather/:city', async (req,res) => {
    const rawCity = req.params.city;
    const city = normalizeCityName(rawCity);

    try {
        // 🌍 Erde
        if(!['Mars','Sonne','Pluto','Venus','Jupiter','Saturn','Mond'].includes(city)) {
            const encoded = encodeURIComponent(rawCity);
            const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encoded}&appid=${openWeatherKey}&units=metric&lang=de`);
            const weather = response.data;
            const tempC = Math.round(weather.main.temp);
            const desc = weather.weather[0].description;
            const emoji = getWeatherEmoji(desc);
            return res.send(`In ${city} ist es aktuell ${tempC}°C (${emoji}${emoji?'':''})`);
        }

        // 🔴 Mars über NASA InSight
        if(city==='Mars') {
            const response = await axios.get(`https://api.nasa.gov/insight_weather/?api_key=${nasaKey}&feedtype=json&ver=1.0`);
            const solKeys = response.data.sol_keys;
            if(!solKeys || solKeys.length===0) return res.send(getRandomError(city));
            const latestSol = solKeys[solKeys.length-1];
            const tempC = Math.round(response.data[latestSol].AT.av);
            const emoji = '🌬️ Windig';
            return res.send(`In ${city} ist es aktuell ${tempC}°C (${emoji})`);
        }

        // 🌞 Andere Planeten / Sterne
        let tempC=0, emoji='🌞 Strahlend';
        switch(city) {
            case 'Sonne': tempC=5505; break;
            case 'Pluto': tempC=-229; emoji='❄️ Frostig'; break;
            case 'Venus': tempC=462; emoji='🔥 Heiß'; break;
            case 'Jupiter': tempC=-145; emoji='🥶 Sehr kalt'; break;
            case 'Saturn': tempC=-178; emoji='🥶 Sehr kalt'; break;
            case 'Mond': tempC=-20; emoji='🌑 Mondig'; break;
            default: return res.send(getRandomError(city));
        }
        return res.send(`In ${city} ist es aktuell ${tempC}°C (${emoji})`);

    } catch(err) {
        return res.send(getRandomError(city));
    }
});

/* ---------------- ROOT ---------------- */
app.get('/',(req,res)=>{
    res.send('✅ API läuft! Verwende /nutzlos/DEIN_NAME oder /weather/STADT/Planet');
});

/* ---------------- START ---------------- */
app.listen(port,()=>console.log(`🚀 Server läuft auf Port ${port}`));
