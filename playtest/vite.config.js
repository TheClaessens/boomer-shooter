// Playtest server: the normal Vite dev server plus PUT /__playtest/out/<file> → playtest/out/ (screenshots).
// npx vite --config playtest/vite.config.js --port 5174 --strictPort
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('playtest/out');
export default {
  plugins: [{
    name: 'playtest-out',
    configureServer(server) {
      fs.mkdirSync(out, { recursive: true });
      server.middlewares.use('/__playtest/out/', (req, res, next) => {
        if (req.method !== 'PUT') return next();
        const name = path.basename(decodeURIComponent(req.url.split('?')[0]));
        if (!/^[\w.-]+\.png$/.test(name)) return res.writeHead(403).end();
        const ws = fs.createWriteStream(path.join(out, name));
        req.pipe(ws);
        ws.on('finish', () => res.writeHead(201).end());
        ws.on('error', () => res.writeHead(500).end());
      });
    },
  }],
};
