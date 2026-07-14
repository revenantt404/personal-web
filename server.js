const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');

app.use(express.static(publicDir));
app.use(express.json());

// Clean URL helpers for folder/index.html pages
function sendPage(res, ...parts) {
  res.sendFile(path.join(publicDir, ...parts));
}

app.get('/', (req, res) => sendPage(res, 'index.html'));

app.get('/about', (req, res) => sendPage(res, 'about', 'index.html'));
app.get('/tentang', (req, res) => res.redirect(301, '/about'));

app.get('/jurnal', (req, res) => sendPage(res, 'jurnal', 'index.html'));
app.get('/journal', (req, res) => res.redirect(301, '/jurnal'));
app.get('/journal.html', (req, res) => res.redirect(301, '/jurnal'));
app.get('/projects', (req, res) => res.redirect(301, '/jurnal'));

app.get('/gallery', (req, res) => sendPage(res, 'gallery', 'index.html'));
app.get('/rig', (req, res) => sendPage(res, 'rig', 'index.html'));

// Contact form (optional)
app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body;
  console.log('New contact message:', { name, email, message });
  res.json({
    success: true,
    message: 'Thanks! Your message has been received.'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(publicDir, '404.html'));
});

app.listen(PORT, () => {
  console.log(`\n✨ Personal Minimal running`);
  console.log(`→ http://localhost:${PORT}`);
  console.log(`→ Environment: ${process.env.NODE_ENV || 'development'}\n`);
});
