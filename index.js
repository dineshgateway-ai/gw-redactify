import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || process.env.HTTP_PORT || 3000;

// 1. Security Headers (Helmet)
// Note: We adjust Content Security Policy (CSP) to allow script execution for Vite-built apps
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'"],
      "connect-src": ["'self'", "*"], // Allow connecting to any backend
    },
  },
}));

// 2. Gzip Compression
app.use(compression());

// 3. Request Logging
app.use(morgan('combined'));

// 4. Health Check Endpoint (for Kubernetes)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// 5. Serve static files with caching
// Cache static assets for 1 year as they have predictable names or content
const cacheOptions = {
  maxAge: '1y',
  immutable: true,
};

app.use(express.static(path.join(__dirname, 'dist'), cacheOptions));

// 6. Handle SPA routing: send all requests to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Production server is running on http://0.0.0.0:${PORT}`);
  console.log(`Serving content from: ${path.join(__dirname, 'dist')}`);
});
