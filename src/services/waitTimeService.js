const { query } = require('../config/db');

/**
 * Predict estimated waiting time for a token in a department
 */
async function calculateEstimatedWaitTime(departmentId, currentTokenId = null) {

  // 1. Get Department
  const deptRows = await query(
    'SELECT * FROM departments WHERE id = ?',
    [departmentId]
  );

  if (!deptRows || deptRows.length === 0) {
    throw new Error('Department not found');
  }

  const department = deptRows[0];
  const avgServiceTimeMins = department.avg_service_time_mins || 5;

  // 2. Active counters (safe fallback = 1)
  const counterRows = await query(
    `SELECT COUNT(*) as activeCount 
     FROM counters 
     WHERE department_id = ?`,
    [departmentId]
  );

  const activeCounters = counterRows[0]?.activeCount || 1;

  // 3. Waiting queue ahead (FIXED ORDER LOGIC)
  let sql = `
    SELECT COUNT(*) as waitingCount 
    FROM tokens 
    WHERE department_id = ? 
    AND status = 'WAITING'
  `;

  let params = [departmentId];

  if (currentTokenId) {
    sql += ` AND created_at <= (SELECT created_at FROM tokens WHERE id = ?)`;
    params.push(currentTokenId);
  }

  const waitingRows = await query(sql, params);
  const waitingAhead = waitingRows[0]?.waitingCount || 0;

  // 4. Calculate wait time
  const estimatedMins = Math.max(
    1,
    Math.floor((waitingAhead * avgServiceTimeMins) / Math.max(1, activeCounters))
  );

  return {
    departmentId,
    departmentName: department.name,
    waitingAhead,
    positionInLine: waitingAhead + 1,
    activeCounters,
    avgServiceTimeMins,
    estimatedWaitMins: estimatedMins
  };
}

module.exports = {
  calculateEstimatedWaitTime
};