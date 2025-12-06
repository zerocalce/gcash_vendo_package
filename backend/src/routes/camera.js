/**
 * camera.js
 * Routes for camera integration with Android phone webcam
 */
const express = require('express');
const axios = require('axios');
const { classifyBill } = require('../utils/gemini');
const router = express.Router();

// Android phone webcam endpoints
const PHONE_CAMERAS = [
  { ip: '192.168.254.107', port: 4747, name: 'Phone WiFi' },
  { ip: '10.21.149.214', port: 4747, name: 'Phone Dev' }
];

// Get camera list
router.get('/list', (req, res) => {
  res.json({
    cameras: PHONE_CAMERAS.map(cam => ({
      ...cam,
      url: `http://${cam.ip}:${cam.port}/video`,
      status: 'active'
    }))
  });
});

// Capture and classify bill from phone camera
router.post('/capture', async (req, res) => {
  try {
    const { cameraIndex = 0 } = req.body;
    const camera = PHONE_CAMERAS[cameraIndex];
    
    if (!camera) {
      return res.status(400).json({ error: 'Invalid camera index' });
    }

    // For now, simulate bill detection with a test image
    // In production, you'd capture from the video stream
    const testImagePath = process.env.CAM_SAMPLE_PATH;
    if (!testImagePath) {
      return res.status(500).json({ error: 'No test image configured' });
    }
    
    const fs = require('fs');
    const imageBuffer = fs.readFileSync(testImagePath);
    
    // Classify using Gemini
    const result = await classifyBill(imageBuffer, 'image/jpeg');
    
    res.json({
      success: true,
      camera: camera.name,
      method: 'test_image',
      result: result
    });
    
  } catch (error) {
    console.error('Camera capture error:', error);
    res.status(500).json({ 
      error: 'Failed to capture or classify',
      details: error.message 
    });
  }
});

// Get live camera stream endpoint
router.get('/stream/:cameraIndex?', (req, res) => {
  const cameraIndex = parseInt(req.params.cameraIndex) || 0;
  const camera = PHONE_CAMERAS[cameraIndex];
  
  if (!camera) {
    return res.status(400).json({ error: 'Invalid camera index' });
  }
  
  // Redirect to phone's video stream
  res.redirect(`http://${camera.ip}:${camera.port}/video`);
});

module.exports = router;
