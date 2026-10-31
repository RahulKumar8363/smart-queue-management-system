const QRCode = require('qrcode');
const {
  sendBookingEmail,
  sendTurnEmail
} = require('../services/emailService');
const { query } = require('../config/db');
const { calculateEstimatedWaitTime } = require('../services/waitTimeService');
const { getIo } = require('../socket/queueSocket');

// ================= BOOK TOKEN =================
async function bookToken(req, res) {
  try {
    const { userName, userPhone, userEmail, departmentId } = req.body;

    if (!userName || !userPhone || !userEmail || !departmentId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    const deptRows = await query(
      'SELECT * FROM departments WHERE id=?',
      [departmentId]
    );

    if (!deptRows.length) {
      return res.status(404).json({
        success: false,
        message: "Department not found"
      });
    }

    const dept = deptRows[0];

    const countRows = await query(
      'SELECT COUNT(*) as count FROM tokens WHERE department_id=?',
      [departmentId]
    );

    const count = countRows?.[0]?.count || 0;
    const tokenNumber = `${dept.prefix}-${101 + count}`;

    const insertResult = await query(
      `INSERT INTO tokens
  (token_number, user_name, user_phone, user_email, department_id, status)
  VALUES (?, ?, ?, ?, ?, 'WAITING')`,
      [tokenNumber, userName, userPhone, userEmail, departmentId]
    );

    const tokenId = insertResult.insertId;

    const waitInfo = await calculateEstimatedWaitTime(departmentId, tokenId);

    await query(
      'UPDATE tokens SET estimated_wait_mins=? WHERE id=?',
      [waitInfo.estimatedWaitMins, tokenId]
    );

    // Generate QR Code
const qrData = `SMART-QUEUE:${tokenId}`;
const qrCodeDataUrl = await QRCode.toDataURL(qrData);

    const newToken = {
      id: tokenId,
      token_number: tokenNumber,
      user_name: userName,
      user_phone: userPhone,
      user_email: userEmail,
      department_id: Number(departmentId),
      department_name: dept.name,
      status: 'WAITING',
      position_in_line: waitInfo.positionInLine,
      waiting_ahead: waitInfo.waitingAhead,
      estimated_wait_mins: waitInfo.estimatedWaitMins,
      qr_code: qrCodeDataUrl,
      booked_at: new Date().toISOString()
    };

    const io = getIo();
    if (io) {
      io.emit('token:booked', newToken);
      io.emit('queue:update', { departmentId: Number(departmentId) });

      io.to(`dept-${departmentId}`).emit('dept:update', {
        type: 'BOOKED',
        data: newToken
      });
    }

    // SEND BOOKING CONFIRMATION EMAIL
    let emailSent = false;

    try {
      await sendBookingEmail(userEmail, newToken);
      emailSent = true;
      console.log("Booking email sent successfully");
    } catch (emailError) {
      console.error("EMAIL ERROR:", emailError.message);
    }

    return res.status(201).json({
      success: true,
      message: "Token booked successfully",
      emailSent,
      data: newToken
    });

  } catch (err) {
    console.error("BOOK ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error booking token"
    });
  }
}

// ================= TOKEN STATUS =================
async function getTokenStatus(req, res) {
  try {
    const { tokenIdentifier } = req.params;

    let rows;

    if (!isNaN(tokenIdentifier)) {
      rows = await query(
        `SELECT t.*, d.name as department_name
         FROM tokens t
         JOIN departments d ON t.department_id=d.id
         WHERE t.id=?`,
        [tokenIdentifier]
      );
    } else {
      rows = await query(
        `SELECT t.*, d.name as department_name
         FROM tokens t
         JOIN departments d ON t.department_id=d.id
         WHERE t.token_number=?`,
        [tokenIdentifier]
      );
    }

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Token not found"
      });
    }

    const token = rows[0];

    let waitInfo = {
      positionInLine: 0,
      waitingAhead: 0,
      estimatedWaitMins: 0
    };

    if (token.status === 'WAITING') {
      waitInfo = await calculateEstimatedWaitTime(
        token.department_id,
        token.id
      );
    }

    return res.json({
      success: true,
      data: {
        ...token,
        position_in_line: waitInfo.positionInLine,
        waiting_ahead: waitInfo.waitingAhead,
        estimated_wait_mins: waitInfo.estimatedWaitMins
      }
    });

  } catch (err) {
    console.error("STATUS ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
}


// ================= VERIFY QR TOKEN =================
async function verifyQRToken(req, res) {
  try {
    const { qrData } = req.body;

    // Validate QR data format
    if (
      typeof qrData !== "string" ||
      !/^SMART-QUEUE:[1-9]\d*$/.test(qrData)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid QR code"
      });
    }

    // Extract token ID
    const tokenId = Number(qrData.split(":")[1]);

    if (!Number.isSafeInteger(tokenId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid token ID"
      });
    }

    // Find token in database
    const rows = await query(
      `SELECT
        t.id,
        t.token_number,
        t.user_name,
        t.status,
        t.department_id,
        d.name AS department_name
      FROM tokens t
      JOIN departments d ON t.department_id = d.id
      WHERE t.id = ?`,
      [tokenId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Token not found"
      });
    }

    const token = rows[0];

    return res.status(200).json({
      success: true,
      message: "QR verified successfully",
      data: token
    });

  } catch (err) {
    console.error("QR VERIFICATION ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error during QR verification"
    });
  }
}

// ================= CHECK-IN TOKEN =================
async function checkInToken(req, res) {
  try {
    const { tokenId } = req.body;

    if (!Number.isSafeInteger(Number(tokenId)) || Number(tokenId) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid token ID"
      });
    }

    const rows = await query(
      "SELECT id, token_number, status, department_id FROM tokens WHERE id = ?",
      [Number(tokenId)]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Token not found"
      });
    }

    if (rows[0].status !== "WAITING") {
      return res.status(409).json({
        success: false,
        message: `Cannot check in. Current status: ${rows[0].status}`
      });
    }

    await query(
      "UPDATE tokens SET status = 'CHECKED_IN' WHERE id = ? AND status = 'WAITING'",
      [Number(tokenId)]
    );

    const updatedRows = await query(
      `SELECT t.id, t.token_number, t.user_name, t.status,
              t.department_id, d.name AS department_name
       FROM tokens t
       JOIN departments d ON t.department_id = d.id
       WHERE t.id = ?`,
      [Number(tokenId)]
    );

    const updatedToken = updatedRows[0];
    const io = getIo();

    if (io) {
      io.emit("queue:update", {
        departmentId: updatedToken.department_id
      });

      io.to(`dept-${updatedToken.department_id}`).emit("dept:update", {
        type: "CHECKED_IN",
        data: updatedToken
      });
    }

    return res.json({
      success: true,
      message: "Patient checked in successfully",
      data: updatedToken
    });

  } catch (err) {
    console.error("CHECK-IN ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during check-in"
    });
  }
}


// ================= QUEUE OVERVIEW =================
async function getQueueOverview(req, res) {
  try {
    const rows = await query(`
      SELECT 
        t.id,
        t.token_number,
        t.user_name,
        t.status,
        t.department_id,
        t.estimated_wait_mins,
        d.name AS department_name,
        d.prefix
      FROM tokens t
      JOIN departments d ON t.department_id = d.id
      ORDER BY t.id ASC
    `);

    return res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error("OVERVIEW ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
}

// ================= CALL NEXT TOKEN =================
async function callNextToken(req, res) {
  try {
    console.log("CALL NEXT BODY:", req.body);

    const { counter_id, departmentId } = req.body;

    if (!counter_id || !departmentId || isNaN(departmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid counter or department"
      });
    }

    const tokens = await query(`
      SELECT * FROM tokens
      WHERE department_id=?
      AND status IN ('WAITING', 'CHECKED_IN')
      ORDER BY id ASC
      LIMIT 1
    `, [departmentId]);

    if (!tokens.length) {
      return res.json({
        success: true,
        message: "No tokens in queue",
        data: null
      });
    }

    const token = tokens[0];

    await query(`
      UPDATE tokens 
      SET status='SERVING',
          counter_id=?
      WHERE id=?
    `, [counter_id || null, token.id]);

    const full = await query(`
      SELECT t.*, d.name as department_name
      FROM tokens t
      JOIN departments d ON t.department_id=d.id
      WHERE t.id=?
    `, [token.id]);

    const currentToken = full[0];
    // Send Your Turn Email
    if (currentToken.user_email) {
      try {
        await sendTurnEmail(currentToken.user_email, currentToken);
        console.log("Your Turn email sent successfully");
      } catch (emailError) {
        console.error("TURN EMAIL ERROR:", emailError.message);
      }
    }

    const io = getIo();
    if (io) {
      io.emit('queue:update', { departmentId });

      io.to(`dept-${departmentId}`).emit('dept:update', {
        type: 'SERVING',
        data: currentToken
      });
    }

    return res.json({
      success: true,
      message: "Next token called",
      data: currentToken
    });

  } catch (err) {
    console.error("CALL NEXT ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
}

module.exports = {
  bookToken,
  getTokenStatus,
  getQueueOverview,
  callNextToken,
  verifyQRToken,
  checkInToken
};