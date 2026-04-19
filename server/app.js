const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Serve the HTML/CSS/JS from the project root (one level up from server/)
app.use(express.static(path.join(__dirname, '..')));

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/compounds', require('./routes/compounds'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Catch-all: serve index.html for any non-API path
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

module.exports = app;
