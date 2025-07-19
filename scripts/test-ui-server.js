#!/usr/bin/env node

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3601;

// Serve static files
app.use(express.static(join(__dirname, '../test-ui')));

// Start server
app.listen(PORT, () => {
  console.log(`Test UI server running at http://localhost:${PORT}`);
});