import express from "express";
import path from "path";
import serverless from "serverless-http";
import fetch from "node-fetch";
const app = express();

// Middleware
app.use(express.json());

// Serve static files (public folder)
app.use(express.static(path.join(__dirname, "../public")));

// --- In-Memory Database (NOTE: resets on Vercel) ---
let messages = [];

const quotes = [
  {
    text: "The secret of getting ahead is getting started.",
    author: "Mark Twain",
  },
  {
    text: "It always seems impossible until it's done.",
    author: "Nelson Mandela",
  },
  {
    text: "Simplicity is the ultimate sophistication.",
    author: "Leonardo da Vinci",
  },
  {
    text: "The only limit to our realization of tomorrow will be our doubts of today.",
    author: "Franklin D. Roosevelt",
  },
];

// --- APIs ---

// 1. Save message
app.post("/message", (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Message required" });

  messages.unshift({
    id: Date.now(),
    text,
    timestamp: new Date().toISOString(),
  });

  if (messages.length > 20) messages.pop();

  res.status(201).json({ success: true });
});

// 2. Get latest message (ESP32)
app.get("/message", (req, res) => {
  res.json({ message: messages.length ? messages[0].text : "No messages" });
});

// 3. History
app.get("/history", (req, res) => res.json(messages));

// 4. Quote
app.get("/quote", (req, res) => {
  res.json(quotes[Math.floor(Math.random() * quotes.length)]);
});

// 5. Weather
app.get("/weather", async (req, res) => {
  const city = req.query.city;
  if (!city) return res.status(400).json({ error: "City is required" });

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
    );
    const geoData = await geoRes.json();

    if (!geoData.results?.length) {
      return res.status(404).json({ error: "City not found" });
    }

    const { latitude, longitude, name } = geoData.results[0];

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`,
    );
    const weatherData = await weatherRes.json();

    const temp = weatherData.current_weather.temperature;
    const code = weatherData.current_weather.weathercode;

    let condition = "Clear";
    if (code >= 1 && code <= 3) condition = "Cloudy";
    else if (code >= 45 && code <= 48) condition = "Foggy";
    else if (code >= 51 && code <= 67) condition = "Rainy";
    else if (code >= 71 && code <= 77) condition = "Snowy";
    else if (code >= 95) condition = "Thunderstorm";

    res.json({ city: name, temperature: temp, condition });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch weather" });
  }
});

// --- Frontend ---
const frontendHTML = `
<!DOCTYPE html>
<html>
<head>
<title>Smart Desk</title>
<style>
body { font-family: Arial; text-align: center; }
input, button { padding: 10px; margin: 5px; }
</style>
</head>
<body>

<h1>SMART DESK</h1>

<input id="msg" placeholder="Message"/>
<button onclick="sendMsg()">Send</button>

<h2>Messages</h2>
<ul id="history"></ul>

<script>
async function fetchHistory(){
  const res = await fetch('/history');
  const data = await res.json();
  document.getElementById('history').innerHTML =
    data.map(m => '<li>' + m.text + '</li>').join('');
}

async function sendMsg(){
  const text = document.getElementById('msg').value;
  if(!text) return;
  await fetch('/message',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({text})
  });
  fetchHistory();
}

fetchHistory();
</script>

</body>
</html>
`;

app.get("/", (req, res) => res.send(frontendHTML));

// Export for Vercel
module.exports = serverless(app);
