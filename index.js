const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// keys (wie besprochen)
const openWeatherKey = 'c335251d781d377a5c8e9c94e3ea7c10';
const nasaKey = 'ucqtnncar4FshdBUccRh56isBbcIdAmJqpZea5VO';

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

/* ---------------- helpers ---------------- */
function normalizeCityName(city) {
  if (!city || typeof city !== 'string') return city;
  const map = { ae: 'ä', oe: 'ö', ue: 'ü', Ae: 'Ä', Oe: 'Ö', Ue: 'Ü', ss: 'ß' };
  let normalized = city;
  for (const [k, v] of Object.entries(map)) {
    normalized = normalized.replace(new RegExp(k, 'g'), v);
  }
  return normalized
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function getRandomError(city) {
  const msgs = [
    `🛸 Hm… Irgendwas stimmt nicht mit "${city}", vielleicht ein Tippfehler? 🤔`,
    `🙃 Ups! Ich finde "${city}" gerade nicht – vielleicht anders schreiben?`,
    `😅 Oh nein, "${city}" existiert nicht… vielleicht falsch geschrieben?`,
    `🤖 "${city}" will mir keine Daten geben. Versuch’s nochmal.`,
    `🤷‍♂️ "${city}" scheint nicht zu existieren. Vielleicht ein Tippfehler?`
  ];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

/* ---------------- sehr vollständige Wetterbeschreibungen (DE + englische Varianten) ----------------
   Quelle: häufige OpenWeatherMap description-strings + Varianten
   (Wir prüfen description.toLowerCase() auf diese keywords)
*/
function getWeatherEmoji(description) {
  if (!description) return '';
  const t = description.toLowerCase();

  const map = [
    // Klar / Sonne
    { kw: ['klarer himmel', 'clear sky', 'klar', 'sonnig', 'sunny'], emoji: '☀️ Sonnig' },
    // Wolken - feine Abstufungen
    { kw: ['few clouds', 'light clouds', 'leicht bewölkt'], emoji: '🌤️ Leicht bewölkt' },
    { kw: ['scattered clouds', 'scattered cloud', 'vereinzelt wolken', 'wolkenfelder'], emoji: '🌥️ Vereinzelte Wolken' },
    { kw: ['broken clouds', 'broken cloud', 'gebrochene wolken'], emoji: '☁️ Stark bewölkt' },
    { kw: ['overcast clouds', 'overcast', 'bedeckt', 'überwiegend bewölkt'], emoji: '☁️ Bedeckt' },

    // Regen / Schauer - fein
    { kw: ['light intensity shower rain', 'light shower rain', 'leichter schauer', 'light shower'], emoji: '🌦️ Leichter Schauer' },
    { kw: ['shower rain', 'shower'], emoji: '🌧️ Schauerregen' },
    { kw: ['ragged shower rain', 'unregelmäßiger schauer', 'ragged shower'], emoji: '🌧️ Unregelmäßiger Schauer' },
    { kw: ['light rain', 'leichter regen'], emoji: '🌦️ Leichter Regen' },
    { kw: ['moderate rain', 'mäßiger regen'], emoji: '🌧️ Mäßiger Regen' },
    { kw: ['heavy intensity rain', 'heavy rain', 'starker regen'], emoji: '🌧️ Starker Regen' },
    { kw: ['very heavy rain', 'very heavy intensity rain', 'sehr starker regen'], emoji: '🌧️ Sehr starker Regen' },
    { kw: ['extreme rain', 'extreme'], emoji: '🌧️ Extrem starker Regen' },
    { kw: ['freezing rain', 'gefriereneder regen'], emoji: '🌨️ Gefrierender Regen' },
    { kw: ['drizzle', 'nieselregen'], emoji: '🌦️ Nieselregen' },

    // Schnee
    { kw: ['light snow', 'leichter schnee'], emoji: '❄️ Leichter Schnee' },
    { kw: ['snow', 'schnee'], emoji: '❄️ Schnee' },
    { kw: ['heavy snow', 'starker schnee'], emoji: '❄️ Starker Schnee' },
    { kw: ['sleet', 'schneeregen'], emoji: '🌨️ Schneeregen' },
    { kw: ['shower snow', 'schneeschauer'], emoji: '🌨️ Schneeschauer' },

    // Gewitter & Blitz
    { kw: ['thunderstorm with light rain', 'gewitter mit leichtem regen'], emoji: '⛈️ Gewitter mit leichtem Regen' },
    { kw: ['thunderstorm with rain', 'gewitter mit regen'], emoji: '⛈️ Gewitter mit Regen' },
    { kw: ['thunderstorm with heavy rain', 'gewitter mit starkem regen'], emoji: '⛈️ Gewitter mit starkem Regen' },
    { kw: ['light thunderstorm', 'leichtes gewitter'], emoji: '⛈️ Leichtes Gewitter' },
    { kw: ['thunderstorm', 'gewitter'], emoji: '⛈️ Gewitter' },
    { kw: ['heavy thunderstorm', 'starkes gewitter'], emoji: '⛈️ Starkes Gewitter' },
    { kw: ['ragged thunderstorm', 'unregelmäßiges gewitter'], emoji: '⛈️ Unregelmäßiges Gewitter' },

    // Nebel / Dunst
    { kw: ['mist', 'nebel', 'dunst', 'fog', 'haze'], emoji: '🌫️ Nebel' },

    // Sand / Staub / Rauch
    { kw: ['sand', 'sand/dust', 'staub', 'dust'], emoji: '🏜️ Sandig' },
    { kw: ['smoke', 'rauch'], emoji: '💨 Rauchig' },
    { kw: ['volcanic ash', 'vulkanasche'], emoji: '🌋 Vulkanasche' },

    // Wind / Stürme
    { kw: ['squalls', 'böen'], emoji: '🌬️ Böen' },
    { kw: ['wind', 'breeze', 'gust', 'windig'], emoji: '🌬️ Windig' },
    { kw: ['tornado'], emoji: '🌪️ Tornado' },
    { kw: ['storm', 'sturm', 'orkan'], emoji: '🌪️ Sturm' },

    // Sonstiges
    { kw: ['clear', 'sun'], emoji: '☀️ Sonnig' },
    { kw: ['rainbow', 'regenbogen'], emoji: '🌈 Regenbogen' }
  ];

  for (const item of map) {
    for (const kw of item.kw) {
      if (t.includes(kw)) return item.emoji;
    }
  }
  return '';
}

/* ---------------- Exoplanet / NASA-Archiv Abfrage ----------------
   Wir verwenden das NASA Exoplanet Archive (IPAC) REST-API (table=exoplanets)
   Query Beispiel liefert JSON mit Feldern wie pl_eqt (equilibrium temp in K)
*/
async function queryExoplanetArchive(name) {
  try {
    // table=exoplanets, where pl_name='Name'
    const url = `https://exoplanetarchive.ipac.caltech.edu/cgi-bin/nstedAPI/nph-nstedAPI?table=exoplanets&format=json&where=pl_name='${encodeURIComponent(name)}'`;
    const resp = await axios.get(url, { timeout: 7000 });
    if (!resp.data || resp.data.length === 0) return null;
    return resp.data[0]; // first match
  } catch (e) {
    return null;
  }
}

/* ---------------- Mars (NASA InSight) ---------------- */
async function queryMarsInsight() {
  try {
    const resp = await axios.get(`https://api.nasa.gov/insight_weather/?api_key=${nasaKey}&feedtype=json&ver=1.0`, { timeout: 7000 });
    if (!resp.data || !resp.data.sol_keys || resp.data.sol_keys.length === 0) return null;
    const latest = resp.data.sol_keys[resp.data.sol_keys.length - 1];
    const solData = resp.data[latest];
    if (!solData || !solData.AT || typeof solData.AT.av !== 'number') return null;
    return Math.round(solData.AT.av); // °C already
  } catch (e) {
    return null;
  }
}

/* ---------------- weather endpoint (master) ---------------- */
app.get('/weather/:place', async (req, res) => {
  const raw = req.params.place;
  const place = normalizeCityName(raw);

  // helper to send with optional weatherPart
  function sendTemp(placeOut, tempC, emojiStr) {
    const part = emojiStr ? ` (${emojiStr})` : '';
    return res.send(`In ${placeOut} ist es aktuell ${tempC}°C${part}`);
  }

  try {
    // 1) Erde - OpenWeatherMap (try)
    // if the place is clearly a solar object by name we'll treat later; otherwise check OpenWeather first
    const solarNames = new Set(['Mars','Sonne','Pluto','Venus','Jupiter','Saturn','Merkur','Uranus','Neptun','Mond','Sirius','Betelgeuse','Alpha Centauri','Milchstraße','Schwarzes Loch']);
    if (!solarNames.has(place)) {
      // use AbortController + timeout safe pattern
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const encoded = encodeURIComponent(raw);
        const ow = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encoded}&appid=${openWeatherKey}&units=metric&lang=de`, { signal: controller.signal });
        clearTimeout(timeout);

        const weather = ow.data;
        const tempC = Math.round(weather.main.temp);
        const desc = weather.weather?.[0]?.description || '';
        const emoji = getWeatherEmoji(desc);

        return sendTemp(place, tempC, emoji);
      } catch (err) {
        clearTimeout(timeout);
        // if OpenWeather fails due to not found (404) we fallback to next steps (exoplanet / solar bodies)
        // for other errors also try next steps (so we don't immediately error)
      }
    }

    // 2) Mars via NASA InSight
    if (place === 'Mars') {
      const marsTemp = await queryMarsInsight();
      if (marsTemp !== null) return sendTemp('Mars', marsTemp, '🌬️ Windig');
      // fallback: if no data from INSIGHT, show friendly error
      return res.send(getRandomError(place));
    }

    // 3) Known solar system / stars (try exoplanet archive for exoplanets/stars)
    // First try Exoplanet Archive (for exoplanets / star names) - query with raw string as provided
    const exo = await queryExoplanetArchive(raw);
    if (exo) {
      // pl_eqt is equilibrium temperature in K in many tables (may be null)
      // try several common fields
      const maybeFields = ['pl_eqt', 'pl_orbeccen', 'pl_orbeccen']; // pl_eqt is main
      if (typeof exo.pl_eqt === 'number') {
        const tempC = Math.round(exo.pl_eqt - 273.15);
        // Use a neutral cosmic emoji
        return sendTemp(exo.pl_name || place, tempC, '🌌');
      }
      // If exoplanet exists but no temp, still return a friendly message
      // but per your request, we should keep same representation only when data exists
      // so if no pl_eqt, we continue to check built-in solar table below
    }

    // 4) Built-in planetary/stars fallback table (only if we have known data)
    const builtin = {
    'Sonne': { temp: 5505, emoji: '☀️ Strahlend' },
    'Merkur': { temp: 167, emoji: '🔥 Glühend' },
    'Venus': { temp: 464, emoji: '🔥 Hitzeschock' },
    'Erde': { temp: 15, emoji: '🌍 Ausgeglichen' },
    'Mond': { temp: -53, emoji: '🌕 Mondklar' },
    'Mars': { temp: -63, emoji: '🌬️ Staubig' },
    'Jupiter': { temp: -145, emoji: '💨 Sturmreich' },
    'Saturn': { temp: -178, emoji: '💨 Windig' },
    'Uranus': { temp: -224, emoji: '❄️ Eisig' },
    'Neptun': { temp: -214, emoji: '🌊 Frostig' },
    'Pluto': { temp: -229, emoji: '🧊 Tiefgefroren' },
    'SchwarzesLoch': { temp: 0, emoji: '🕳️ Unendlich dunkel' },
    'Sirius': { temp: 9940, emoji: '🌟 Gleißend hell' },
    'Betelgeuse': { temp: 3500, emoji: '🌟 Glühend rot' },
    'Alpha Centauri': { temp: 5790, emoji: '✨ Sonnengleich' },
    'Milchstraße': { temp: -270, emoji: '🌌 Kosmisch kalt' },
    'Andromeda': { temp: -271, emoji: '🌌 Fern und frostig' },
    'Exoplanet Kepler-452b': { temp: 265, emoji: '🪐 Mild' },
    'Proxima Centauri b': { temp: -39, emoji: '🌫️ Kalt und fern' }
    };

    if (builtin[place]) {
      const obj = builtin[place];
      return sendTemp(place, obj.temp, obj.emoji);
    }

    // 5) If we got here and nothing matched, final fallback: try OpenWeather with raw again but without normalization
    try {
      const encoded2 = encodeURIComponent(raw);
      const resp2 = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encoded2}&appid=${openWeatherKey}&units=metric&lang=de`, { timeout: 5000 });
      const tempC = Math.round(resp2.data.main.temp);
      const desc = resp2.data.weather?.[0]?.description || '';
      const emoji = getWeatherEmoji(desc);
      return sendTemp(raw, tempC, emoji);
    } catch (e) {
      // nothing found: friendly error
      return res.send(getRandomError(place));
    }

  } catch (err) {
    return res.send(getRandomError(place));
  }
});

/* ---------------- root ---------------- */
app.get('/', (req, res) => {
  res.send('✅ API läuft! Verwende /weather/STADT oder /weather/PLANET oder /weather/ExoplanetName');
});

/* ---------------- start ---------------- */
app.listen(port, () => console.log(`🚀 Server läuft auf Port ${port}`));


