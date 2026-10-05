const { query } = require('../config/db');

async function getAnalytics(req, res) {
  try {
    const totalRows = await query('SELECT COUNT(*) as total FROM tokens');
    const totalBooked = totalRows[0]?.total || totalRows[0]?.['COUNT(*)'] || 0;

    const completedRows = await query('SELECT COUNT(*) as count FROM tokens WHERE status = "COMPLETED"');
    const completedCount = completedRows[0]?.count || completedRows[0]?.['COUNT(*)'] || 0;

    const waitingRows = await query('SELECT COUNT(*) as count FROM tokens WHERE status = "WAITING"');
    const waitingCount = waitingRows[0]?.count || waitingRows[0]?.['COUNT(*)'] || 0;

    const calledRows = await query('SELECT COUNT(*) as count FROM tokens WHERE status IN ("CALLED", "IN_PROGRESS")');
    const servingCount = calledRows[0]?.count || calledRows[0]?.['COUNT(*)'] || 0;

    const cancelledRows = await query('SELECT COUNT(*) as count FROM tokens WHERE status IN ("CANCELLED", "NO_SHOW")');
    const cancelledCount = cancelledRows[0]?.count || cancelledRows[0]?.['COUNT(*)'] || 0;

    // Average Wait Time calculation
    const avgWaitRows = await query('SELECT AVG(estimated_wait_mins) as avgWait FROM tokens WHERE status = "COMPLETED"');
    const avgWaitTime = Math.round(avgWaitRows[0]?.avgWait || 4);

    // Department Breakdown
    const deptBreakdown = await query(`
      SELECT d.name as department_name, COUNT(t.id) as token_count 
      FROM departments d 
      LEFT JOIN tokens t ON d.id = t.department_id 
      GROUP BY d.id, d.name
    `);

    res.json({
      success: true,
      data: {
        summary: {
          totalBooked,
          completedCount,
          waitingCount,
          servingCount,
          cancelledCount,
          avgWaitTimeMins: avgWaitTime
        },
        departmentBreakdown: deptBreakdown
      }
    });
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = {
  getAnalytics
};
