const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/verifyToken');
const { authorizeRole } = require('../middleware/verifyToken');
const {
    getDashboardSummary,
    getDailySalesReport,
    downloadDailySalesReportPdf,
    downloadDailySalesReportExcel,
    downloadDailySalesReportCsv
} = require('../controllers/DashboardController');
const {
    getEmailReportSetting,
    updateEmailReportSetting
} = require('../controllers/EmailReportController');

router.get('/laporan-penjualan-harian', verifyToken, authorizeRole('superadmin'), getDailySalesReport);
router.get('/laporan-penjualan-harian/pdf', verifyToken, authorizeRole('superadmin'), downloadDailySalesReportPdf);
router.get('/laporan-penjualan-harian/excel', verifyToken, authorizeRole('superadmin'), downloadDailySalesReportExcel);
router.get('/laporan-penjualan-harian/csv', verifyToken, authorizeRole('superadmin'), downloadDailySalesReportCsv);
router.get('/email-report-setting', verifyToken, authorizeRole('superadmin'), getEmailReportSetting);
router.put('/email-report-setting', verifyToken, authorizeRole('superadmin'), updateEmailReportSetting);
router.get('/', verifyToken, getDashboardSummary);

module.exports = router;
