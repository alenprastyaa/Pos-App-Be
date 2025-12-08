const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/verifyToken');
const { getDashboardSummary } = require('../controllers/DashboardController');

router.get('/', verifyToken, getDashboardSummary);

module.exports = router;