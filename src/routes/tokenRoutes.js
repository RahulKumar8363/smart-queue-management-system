
const express = require('express');
const router = express.Router();

const {
  bookToken,
  getTokenStatus,
  getQueueOverview,
  callNextToken,
  verifyQRToken,
  checkInToken
} = require('../controllers/tokenController');

const { query } = require('../config/db');
const { getIo } = require('../socket/queueSocket');
const { sendCompletionEmail } = require('../services/emailService');
const verifyAdminToken = require('../middleware/authMiddleware');

// ================= BOOK TOKEN (PUBLIC) =================
router.post('/book', bookToken);

// ================= CALL NEXT (PROTECTED) =================
router.post('/call-next', verifyAdminToken, callNextToken);

// ================= QUEUE OVERVIEW (PUBLIC) =================
router.get('/overview', getQueueOverview);

// ================= PATIENT STATUS (PUBLIC) =================
router.get('/status/:tokenIdentifier', getTokenStatus);

// ================= QR VERIFICATION (PROTECTED) =================
router.post('/verify-qr', verifyAdminToken, verifyQRToken);

// ================= PATIENT CHECK-IN (PROTECTED) =================
router.post('/check-in', verifyAdminToken, checkInToken);

// ================= TOKEN STATUS UPDATE (PROTECTED) =================
router.patch('/status/:id', verifyAdminToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  // Validate status
  const allowedStatuses = ['WAITING', 'SERVING', 'COMPLETED', 'NO_SHOW'];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid token status'
    });
  }

  try {
    const updated = await query(
      `SELECT t.*, d.name AS department_name
       FROM tokens t
       JOIN departments d ON t.department_id = d.id
       WHERE t.id = ?`,
      [id]
    );

    if (!updated.length) {
      return res.status(404).json({
        success: false,
        message: 'Token not found'
      });
    }

    await query(
      'UPDATE tokens SET status = ? WHERE id = ?',
      [status, id]
    );

    const token = {
      ...updated[0],
      status
    };

    // Send Completion Email
    if (status === 'COMPLETED' && token.user_email) {
      try {
        await sendCompletionEmail(token.user_email, token);
        console.log('Completion email sent successfully');
      } catch (emailError) {
        console.error('COMPLETION EMAIL ERROR:', emailError.message);
      }
    }

    // REALTIME UPDATE
    const io = getIo();

    if (io) {
      io.emit('queue:update', {
        departmentId: token.department_id
      });

      io.to(`dept-${token.department_id}`).emit('dept:update', {
        type: 'STATUS_UPDATE',
        data: token
      });
    }

    return res.json({
      success: true,
      data: token
    });

  } catch (err) {
    console.error('STATUS UPDATE ERROR:', err);

    return res.status(500).json({
      success: false,
      message: 'Status update failed'
    });
  }
});

module.exports = router;
