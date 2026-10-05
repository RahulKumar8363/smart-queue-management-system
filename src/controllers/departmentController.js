const { query } = require("../config/db");

async function getDepartments(req, res) {
  try {
    console.log("API HIT");

    const departments = await query("SELECT * FROM departments");

    console.log("DATA:", departments);

    return res.json({
      success: true,
      data: departments || []
    });

  } catch (err) {
    console.log("ERROR FULL:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
}

module.exports = { getDepartments };