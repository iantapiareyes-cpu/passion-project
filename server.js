import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Serve static assets from root and public
app.use(express.static(__dirname));
if (path.join(__dirname, 'public')) {
  app.use(express.static(path.join(__dirname, 'public')));
}

// Fallback to index.html for all requests
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Football Passion server listening on http://0.0.0.0:${PORT}`);
});
