'use strict';
const assert = require('assert');

let GoogleGenerativeAI;
try {
  ({ GoogleGenerativeAI } = require('@google/generative-ai'));
} catch (e) {
  GoogleGenerativeAI = null;
}

const MODEL_NAME = process.env.GEMINI_MODEL || process.env.GEMINI_API_MODEL || 'gemini-1.5-flash-latest';

function normalizeModelName(name) {
  const n = String(name || '').trim();
  if (!n) return 'gemini-1.5-flash-latest';
  if (/^gemini-1\.5-/.test(n) && !/-latest$/.test(n)) {
    return n + '-latest';
  }
  return n;
}

function parseJson(text) {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end >= start) {
      return JSON.parse(text.slice(start, end + 1));
    }
  } catch (_) {}
  return null;
}

async function classifyBill(imageBuffer, mimeType = 'image/jpeg') {
  if (!GoogleGenerativeAI) {
    throw new Error("@google/generative-ai is not installed. Run: npm i @google/generative-ai");
  }
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  assert(apiKey, 'GOOGLE_API_KEY missing');
  assert(Buffer.isBuffer(imageBuffer), 'imageBuffer must be a Buffer');

  const genAI = new GoogleGenerativeAI(apiKey);
  const base64 = imageBuffer.toString('base64');
  const input = [
    { 
      text: JSON.stringify({
        instruction: 'You are a Philippine banknote expert. Look at this image and determine the exact denomination. Focus on the large numbers printed on the note - 20, 50, 100, 200, 500, or 1000. Check both the numeric digits and any text stating the value. Do not guess - be certain. Return JSON: {"denomination": number, "confidence": 0.0-1.0, "is_genuine": 0.0-1.0, "currency": "PHP", "reasons": "explanation"}'
      }) 
    },
    { inlineData: { data: base64, mimeType } }
  ];

  const candidates = Array.from(new Set([
    normalizeModelName(MODEL_NAME),
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.0-pro-vision-latest',
    'gemini-pro-vision'
  ]));

  let lastError;
  for (const name of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: name });
      const resp = await model.generateContent(input);
      const text = resp?.response?.text?.() || resp?.response?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
      const parsed = parseJson(text) || {};
      // Normalize fields from various possible keys
      let denomination = parsed.denomination;
      if (denomination == null) denomination = parsed.value;
      if (denomination == null) denomination = parsed.amount;
      if (denomination == null) denomination = parsed.note_value;
      if (denomination == null) denomination = parsed.banknote_value;
      denomination = Number(denomination);

      let confidence = parsed.confidence;
      if (confidence == null) confidence = parsed.confidence_score;
      if (confidence == null) confidence = parsed.score;
      confidence = Number(confidence);
      if (!Number.isFinite(confidence)) confidence = null;

      let isGenuine = parsed.is_genuine;
      if (isGenuine == null) isGenuine = parsed.genuine;
      if (isGenuine == null) isGenuine = parsed.authentic;
      if (isGenuine == null) isGenuine = parsed.authenticity;
      if (typeof isGenuine === 'boolean') isGenuine = isGenuine ? 1 : 0;
      isGenuine = Number(isGenuine);
      if (!Number.isFinite(isGenuine)) isGenuine = null;
      return {
        raw: text,
        model: name,
        currency: parsed.currency || 'PHP',
        denomination: Number.isFinite(denomination) ? denomination : null,
        confidence: confidence,
        is_genuine: isGenuine,
        reasons: parsed.reasons || []
      };
    } catch (e) {
      const msg = (e && e.message || '').toLowerCase();
      lastError = e;
      if (msg.includes('404') || msg.includes('not found')) {
        continue; // try next model
      }
      throw e; // other errors -> stop
    }
  }
  throw lastError || new Error('All Gemini model attempts failed');
}

module.exports = { classifyBill };
