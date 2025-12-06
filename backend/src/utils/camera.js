'use strict';
const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function snapshot() {
  let filePath = process.env.CAM_SAMPLE_PATH;
  const url = process.env.CAM_SAMPLE_URL;
  if (filePath) {
    // Trim whitespace and optional surrounding quotes
    filePath = String(filePath).trim();
    if ((filePath.startsWith('"') && filePath.endsWith('"')) || (filePath.startsWith('\'') && filePath.endsWith('\''))) {
      filePath = filePath.slice(1, -1);
    }
    const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    const buf = await fs.promises.readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
    return { buffer: buf, mimeType };
  }
  if (url) {
    const resp = await axios.get(url, { responseType: 'arraybuffer' });
    const ctype = resp.headers['content-type'] || 'image/jpeg';
    return { buffer: Buffer.from(resp.data), mimeType: ctype };
  }
  throw new Error('No CAM_SAMPLE_PATH or CAM_SAMPLE_URL configured');
}

module.exports = { snapshot };
