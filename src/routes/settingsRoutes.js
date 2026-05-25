// src/routes/settingsRoutes.js
const express = require('express');
const router  = express.Router();
const {
  getAllSettings,
  updateSettings,
  resetSettings,
} = require('../controllers/settingsController');

router.get('/',                    getAllSettings);
router.put('/',                    updateSettings);
router.delete('/reset/:category',  resetSettings);
router.delete('/reset',            resetSettings);   // reset all

module.exports = router;
