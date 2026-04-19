const router      = require('express').Router();
const pool        = require('../db/pool');
const verifyToken = require('../middleware/auth');

router.use(verifyToken);

// GET /api/dashboard
router.get('/', async (req, res, next) => {
  try {
    const { rows: stats } = await pool.query(`
      SELECT
        COUNT(*)                                                          AS total,
        COUNT(*) FILTER (WHERE status = 'approved')                      AS approved,
        COUNT(*) FILTER (WHERE status = 'pending')                       AS pending,
        COUNT(*) FILTER (WHERE status = 'rejected')                      AS rejected,
        COUNT(*) FILTER (WHERE bud < NOW() AND status = 'approved')      AS expired,
        COUNT(*) FILTER (WHERE bud >= NOW()
                           AND bud <= NOW() + INTERVAL '5 days'
                           AND status = 'approved')                      AS expiring_soon
      FROM compounds
    `);

    const { rows: riskList } = await pool.query(`
      SELECT id, name, strength, lot_number, quantity, unit, bud, date_made
      FROM compounds
      WHERE status = 'approved'
      ORDER BY bud ASC
      LIMIT 10
    `);

    const { rows: recentActivity } = await pool.query(`
      SELECT al.*, u.name AS user_name, c.name AS compound_name, c.strength AS compound_strength, c.unit AS compound_unit
      FROM activity_log al
      JOIN users u     ON al.user_id     = u.id
      JOIN compounds c ON al.compound_id = c.id
      WHERE (al.action != 'rejected' OR al.created_at >= CURRENT_DATE)
      ORDER BY al.created_at DESC
      LIMIT 10
    `);

    res.json({
      stats: stats[0],
      risk_list: riskList,
      recent_activity: recentActivity,
    });
  } catch (err) { next(err); }
});

module.exports = router;
