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
      WHERE department_id=? AND status='WAITING'
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
  callNextToken
};