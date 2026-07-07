const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/rig', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'rig.html'));
});

app.get('/tentang', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tentang.html'));
});
app.get('/about', (req, res) => {
  res.redirect(301, '/tentang');
});

app.get('/jurnal', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'journal.html'));
});
app.get('/journal', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'journal.html'));
});

// legacy: /projects -> redirect ke /jurnal
app.get('/projects', (req, res) => {
  res.redirect(301, '/jurnal');
});

app.get('/gallery', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'gallery.html'));
});

// Simple API untuk contact form (opsional)
app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body;
  console.log('Pesan kontak baru:', { name, email, message });
  // Di sini kamu bisa integrasi ke Email, Notion, Database, dll.
  res.json({ 
    success: true, 
    message: 'Terima kasih! Pesanmu sudah diterima.' 
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n✨ Personal Minimal running`);
  console.log(`→ http://localhost:${PORT}`);
  console.log(`→ Environment: ${process.env.NODE_ENV || 'development'}\n`);
});
