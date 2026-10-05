const express = require('express');
const router = express.Router();

const {
  bookToken,
  getTokenStatus,
  getQueueOverview,
  callNextToken
} = require('../controllers/tokenController');

const { query } = require('../config/db');
const { getIo } = require('../socket/queueSocket');

// ================= BOOK =================
router.post('/book', bookToken);

// ================= CALL NEXT =================
router.post('/call-next', callNextToken);

// ================= OVERVIEW =================
router.get('/overview', getQueueOverview);

// ================= STATUS GET =================
router.get('/status/:tokenIdentifier', getTokenStatus);

// ================= STATUS UPDATE (FIXED REALTIME) =================
router.patch('/status/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    await query(
      "UPDATE tokens SET status=? WHERE id=?",
      [status, id]
    );

    const updated = await query(
      `SELECT t.*, d.name as department_name
       FROM tokens t
       JOIN departments d ON t.department_id=d.id
       WHERE t.id=?`,
      [id]
    );

    const token = updated[0];

    // 🔥 REALTIME UPDATE FIX
    const io = getIo();
    if (io) {
      io.emit("queue:update");
      io.to(`dept-${token.department_id}`).emit("dept:update", {
        type: "STATUS_UPDATE",
        data: token
      });
    }

    return res.json({
      success: true,
      data: token
    });

  } catch (err) {
    console.error("STATUS UPDATE ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Status update failed"
    });
  }
});

module.exports = router;