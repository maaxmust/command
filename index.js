const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// API Keys
const weatherApiKey = 'c335251d781d377a5c8e9c94e3ea7c10'; // OpenWeatherMap
const nasaApiKey = 'ucqtnncar4FshdBUccRh56isBbcIdAmJqpZea5VO'; // NASA

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

/* ---------------- HILFSFUNKTIONEN ---------------- */
function normalizeCityName(city) {
  if (!city || typeof city !== 'string') return city;
  const map = { ae:'ä', oe:'ö', ue:'ü', Ae:'Ä', Oe:'Ö', Ue:'Ü', ss:'ß' };
  let normalized = city;
  for (const [key, value] of Object.entries(map)) {
    normalized = normalized.replace(new RegExp(key,'g'), value);
  }
  return normalized
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// Temperaturbeschreibung
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

// Wetterbeschreibung + Tag/Nacht
function getWeatherEmoji(description, isDay) {
  const text = description.toLowerCase();
  const map = [
    { keywords: ['klarer himmel','sonnig','clear'], emoji: isDay ? '🌞 Klarer Himmel' : '🌜 Klarer Himmel' },
    { keywords: ['few clouds','leicht bewölkt'], emoji: '🌤️ Leicht bewölkt' },
    { keywords: ['scattered clouds','bewölkt'], emoji: '🌥️ Bewölkt' },
    { keywords: ['broken clouds','stark bewölkt'], emoji: '☁️ Stark bewölkt' },
    { keywords: ['overcast clouds','bedeckt','überwiegend bewölkt'], emoji: '☁️ Bedeckt' },
    { keywords: ['light rain','leichter regen','drizzle','nieselregen'], emoji: '🌦️ Leichter Regen' },
    { keywords: ['moderate rain','mäßiger regen'], emoji: '🌧️ Mäßiger Regen' },
    { keywords: ['heavy rain','starker regen'], emoji: '🌧️ Starker Regen' },
    { keywords: ['very heavy rain','extremer regen'], emoji: '🌧️ Extrem starker Regen' },
    { keywords: ['freezing rain','gefriereneder regen'], emoji: '🌨️ Gefrierender Regen' },
    { keywords: ['light snow','leichter schnee'], emoji: '❄️ Leichter Schnee' },
    { keywords: ['snow','schnee'], emoji: '❄️ Schnee' },
    { keywords: ['heavy snow','starker schnee'], emoji: '❄️ Starker Schnee' },
    { keywords: ['sleet','schneeregen'], emoji: '🌨️ Schneeregen' },
    { keywords: ['shower snow','schauer schnee'], emoji: '🌨️ Schneeschauer' },
    { keywords: ['thunderstorm','gewitter'], emoji: '⛈️ Gewitter' },
    { keywords: ['mist','fog','nebel','dunst'], emoji: '🌫️ Nebel' },
    { keywords: ['smoke','rauch'], emoji: '💨 Rauch' },
    { keywords: ['sand','sandig'], emoji: '🏜️ Sandig' },
    { keywords: ['dust','staub'], emoji: '💨 Staubig' },
    { keywords: ['volcanic ash','vulkanasche'], emoji: '🌋 Vulkanasche' },
    { keywords: ['squalls','böen'], emoji: '🌬️ Böen' },
    { keywords: ['tornado'], emoji: '🌪️ Tornado' },
    { keywords: ['wind','breeze','gust'], emoji: '🌬️ Windig' },
    { keywords: ['storm','sturm','orkan'], emoji: '🌪️ Sturm' },
    { keywords: ['rainbow','regenbogen'], emoji: '🌈 Regenbogen' }
  ];
  for (const item of map) {
    if (item.keywords.some(kw => text.includes(kw))) return item.emoji;
  }
  return ''; // kein Keyword -> leer, nur Temperatur
}

// Sympathische Fehlertexte
function getRandomError(city) {
  const messages = [
    `🛸 Hm… Irgendwas stimmt nicht mit ${city}, vielleicht ein Tippfehler? 🤔`,
    `🙃 Ups! Ich finde ${city} gerade nicht, vielleicht ein Tippfehler? 🤔`,
    `😅 Oh nein, ${city} existiert nicht… vielleicht falsch geschrieben?`,
    `🤖 Hm… ${city} will mir keine Wetterdaten geben. Noch ein Versuch?`,
    `🤷‍♂️ Hm, ${city} scheint nicht zu existieren. Vielleicht ein Tippfehler?`
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

/* ---------------- WETTER-ROUTE ---------------- */
app.get('/weather/:city', async (req,res) => {
  const rawCity = req.params.city;
  const displayCity = normalizeCityName(rawCity);
  const encodedCity = encodeURIComponent(rawCity);

  try {
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodedCity}&appid=${weatherApiKey}&units=metric&lang=de`);
    const data = response.data;

    const tempC = Math.round(data.main.temp);
    const isDay = data.dt >= data.sys.sunrise && data.dt <= data.sys.sunset; // Tag/Nacht
    const weatherDesc = data.weather[0].description;

    const weatherEmoji = getWeatherEmoji(weatherDesc, isDay);
    const tempDesc = getTemperatureDescription(tempC);

    res.send(`In ${displayCity} ist es aktuell ${tempC}°C (${weatherEmoji ? weatherEmoji + ', ' : ''}${tempDesc})`);
  } catch(err) {
    res.send(getRandomError(displayCity));
  }
});

/* ---------------- NASA ROUTE ---------------- */
app.get('/nasa/:object', async (req,res) => {
  const object = req.params.object.toLowerCase();

  try {
    // Beispiel: NASA Astronomy Picture of the Day (APOD) mit info
    const response = await axios.get(`https://api.nasa.gov/planetary/apod?api_key=${nasaApiKey}`);
    const title = response.data.title;
    const date = response.data.date;
    const explanation = response.data.explanation;

    res.send(`🚀 NASA Info für ${object}: ${title} (${date})\n${explanation}`);
  } catch(err) {
    res.send(`😅 NASA konnte ${object} gerade nicht finden.`);
  }
});

/* ---------------- ROOT ---------------- */
app.get('/', (req,res) => {
  res.send('✅ API läuft! /nutzlos/NAME /weather/STADT /nasa/OBJECT');
});

/* ---------------- START ---------------- */
app.listen(port, ()=> console.log(`🚀 Server läuft auf Port ${port}`));
