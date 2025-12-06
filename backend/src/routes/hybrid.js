'use strict';
const express = require('express');
const router = express.Router();
const bus = require('../utils/bus');
const camera = require('../utils/camera');
const { classifyBill } = require('../utils/gemini');

// Hybrid classification state
const classificationState = {
  mode: 'hybrid', // 'gemini', 'tflite', 'hybrid'
  geminiThreshold: 0.7,
  failedAttempts: 0,
  maxFailures: 3,
  lastResults: []
};

// Fallback TFLite simulation (replace with actual TFLite integration)
function runTFLiteClassification(imageBuffer) {
  return new Promise((resolve) => {
    // Simulate TFLite inference delay
    setTimeout(() => {
      // Simulate classification result
      const denominations = [20, 50, 100, 200, 500, 1000];
      const randomDenom = denominations[Math.floor(Math.random() * denominations.length)];
      const confidence = 0.6 + Math.random() * 0.3; // 0.6-0.9 range
      
      resolve({
        source: 'tflite',
        denomination: randomDenom,
        confidence: confidence,
        processingTime: 50 // ms
      });
    }, 50);
  });
}

router.post('/classify', async (req, res) => {
  try {
    const startTime = Date.now();
    const { buffer, mimeType } = await camera.snapshot();
    let result;
    let usedFallback = false;

    // Determine classification strategy
    if (classificationState.mode === 'gemini' || 
        (classificationState.mode === 'hybrid' && classificationState.failedAttempts < classificationState.maxFailures)) {
      
      // Try Gemini classification
      try {
        const geminiResult = await classifyBill(buffer, mimeType);
        
        // Check confidence threshold
        if (geminiResult.denomination && 
            (!geminiResult.confidence || geminiResult.confidence >= classificationState.geminiThreshold)) {
          
          result = {
            ...geminiResult,
            source: 'gemini',
            processingTime: Date.now() - startTime
          };
          
          // Reset failure counter on success
          classificationState.failedAttempts = 0;
          
        } else {
          // Gemini confidence too low, use fallback
          usedFallback = true;
        }
      } catch (geminiError) {
        console.error('[HYBRID] Gemini classification failed:', geminiError.message);
        usedFallback = true;
        classificationState.failedAttempts++;
      }
    }

    // Use TFLite fallback if needed
    if (!result) {
      result = await runTFLiteClassification(buffer);
      result.processingTime = Date.now() - startTime;
      
      if (usedFallback) {
        console.log('[HYBRID] Used TFLite fallback (Gemini failures:', classificationState.failedAttempts, ')');
      }
    }

    // Store result for tracking
    classificationState.lastResults.unshift({
      ...result,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 10 results
    if (classificationState.lastResults.length > 10) {
      classificationState.lastResults = classificationState.lastResults.slice(0, 10);
    }

    // Emit bill detected event
    if (result.denomination && (req.query.emit === '1' || req.body?.emit === true)) {
      bus.emit('bill.detected', { 
        denomination: result.denomination, 
        confidence: result.confidence,
        source: result.source
      });
    }

    res.json({ 
      ok: true, 
      result,
      mode: classificationState.mode,
      state: {
        failedAttempts: classificationState.failedAttempts,
        maxFailures: classificationState.maxFailures,
        geminiThreshold: classificationState.geminiThreshold
      }
    });

  } catch (err) {
    console.error('[HYBRID] Classification error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Configuration endpoints
router.post('/mode', (req, res) => {
  const { mode } = req.body;
  if (['gemini', 'tflite', 'hybrid'].includes(mode)) {
    classificationState.mode = mode;
    classificationState.failedAttempts = 0; // Reset on mode change
    console.log('[HYBRID] Mode changed to:', mode);
    res.json({ ok: true, mode });
  } else {
    res.status(400).json({ ok: false, error: 'Invalid mode' });
  }
});

router.post('/threshold', (req, res) => {
  const { threshold } = req.body;
  if (typeof threshold === 'number' && threshold >= 0 && threshold <= 1) {
    classificationState.geminiThreshold = threshold;
    console.log('[HYBRID] Gemini threshold set to:', threshold);
    res.json({ ok: true, threshold });
  } else {
    res.status(400).json({ ok: false, error: 'Invalid threshold' });
  }
});

router.get('/status', (req, res) => {
  res.json({
    ok: true,
    mode: classificationState.mode,
    state: {
      failedAttempts: classificationState.failedAttempts,
      maxFailures: classificationState.maxFailures,
      geminiThreshold: classificationState.geminiThreshold
    },
    lastResults: classificationState.lastResults.slice(0, 5) // Return last 5 results
  });
});

router.post('/reset', (req, res) => {
  classificationState.failedAttempts = 0;
  classificationState.lastResults = [];
  console.log('[HYBRID] State reset');
  res.json({ ok: true });
});

module.exports = router;
