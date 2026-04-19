const router      = require('express').Router();
const pool        = require('../db/pool');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

router.use(verifyToken);

// GET /api/compounds
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = 'WHERE c.status = $1';
    }
    const { rows } = await pool.query(`
      SELECT c.*,
             u_created.name  AS created_by_name,
             u_approved.name AS approved_by_name,
             u_rejected.name AS rejected_by_name
      FROM compounds c
      LEFT JOIN users u_created  ON c.created_by  = u_created.id
      LEFT JOIN users u_approved ON c.approved_by = u_approved.id
      LEFT JOIN users u_rejected ON c.rejected_by = u_rejected.id
      ${where}
      ORDER BY c.created_at DESC
    `, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/compounds
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, strength, type, quantity, unit, date_made, bud, bud_override_reason } = req.body;

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(2);
    const prefix = `${dd}${mm}${yy}`;
    const { rows: countRows } = await client.query(
      "SELECT COUNT(*) FROM compounds WHERE lot_number LIKE $1",
      [`${prefix}%`]
    );
    const cc = String(parseInt(countRows[0].count)).padStart(2, '0');
    const lot_number = `${prefix}${cc}`;

    const { rows } = await client.query(`
      INSERT INTO compounds
        (name, strength, type, lot_number, quantity, unit, date_made, bud,
         bud_override_reason, status, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10)
      RETURNING *
    `, [name, strength, type, lot_number, quantity, unit,
        date_made, bud, bud_override_reason || null, req.user.id]);

    const compound = rows[0];

    await client.query(
      `INSERT INTO activity_log (user_id, action, compound_id, notes) VALUES ($1,'created',$2,$3)`,
      [req.user.id, compound.id, `Created ${quantity} ${unit}`]
    );

    await client.query('COMMIT');
    res.status(201).json(compound);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/compounds/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: cRows } = await pool.query(`
      SELECT c.*,
             u_created.name  AS created_by_name,
             u_approved.name AS approved_by_name,
             u_rejected.name AS rejected_by_name,
             u_override.name AS bud_overridden_by_name
      FROM compounds c
      LEFT JOIN users u_created  ON c.created_by        = u_created.id
      LEFT JOIN users u_approved ON c.approved_by       = u_approved.id
      LEFT JOIN users u_rejected ON c.rejected_by       = u_rejected.id
      LEFT JOIN users u_override ON c.bud_overridden_by = u_override.id
      WHERE c.id = $1
    `, [req.params.id]);

    if (!cRows.length) return res.status(404).json({ message: 'Compound not found' });

    const { rows: ingRows } = await pool.query(
      'SELECT * FROM ingredients WHERE compound_id = $1 ORDER BY id',
      [req.params.id]
    );

    const { rows: logRows } = await pool.query(`
      SELECT al.*, u.name AS user_name
      FROM activity_log al
      JOIN users u ON al.user_id = u.id
      WHERE al.compound_id = $1
      ORDER BY al.created_at DESC
    `, [req.params.id]);

    res.json({ ...cRows[0], ingredients: ingRows, activity_log: logRows });
  } catch (err) { next(err); }
});

// DELETE /api/compounds/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM compounds WHERE id = $1', [req.params.id]);
    res.json({ message: 'Compound removed' });
  } catch (err) { next(err); }
});

// PATCH /api/compounds/:id/quantity — reduce stock by N (whole number); deletes if qty hits 0
router.patch('/:id/quantity', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const remove = parseInt(req.body.remove, 10);
    if (!remove || remove <= 0) {
      return res.status(400).json({ message: 'Quantity to remove must be a positive integer' });
    }
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT quantity, unit FROM compounds WHERE id = $1',
      [req.params.id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Compound not found' });
    }
    const current = rows[0].quantity;
    if (remove > current) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Cannot remove ${remove} — only ${current} ${rows[0].unit} in stock` });
    }
    if (remove === current) {
      await client.query('DELETE FROM compounds WHERE id = $1', [req.params.id]);
      await client.query('COMMIT');
      return res.json({ deleted: true });
    }
    const { rows: updated } = await client.query(
      'UPDATE compounds SET quantity = quantity - $1 WHERE id = $2 RETURNING *',
      [remove, req.params.id]
    );
    await client.query(
      `INSERT INTO activity_log (user_id, action, compound_id, notes) VALUES ($1,'removed',$2,$3)`,
      [req.user.id, req.params.id, `Removed ${remove} ${updated[0].unit}`]
    );
    await client.query('COMMIT');
    res.json(updated[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /api/compounds/:id/resubmit — edit a rejected compound and put it back in pending
router.patch('/:id/resubmit', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { name, strength, type, quantity, unit, date_made, bud, bud_override_reason } = req.body;
    await client.query('BEGIN');
    const { rows } = await client.query(`
      UPDATE compounds
      SET name=$1, strength=$2, type=$3, quantity=$4, unit=$5,
          date_made=$6, bud=$7, bud_override_reason=$8,
          status='pending', rejected_by=NULL, rejected_at=NULL, rejection_note=NULL
      WHERE id=$9 AND status='rejected'
      RETURNING *
    `, [name, strength, type, parseInt(quantity, 10), unit,
        date_made, bud, bud_override_reason || null, req.params.id]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Compound not found or not rejected' });
    }
    await client.query(
      `INSERT INTO activity_log (user_id, action, compound_id, notes) VALUES ($1,'created',$2,$3)`,
      [req.user.id, req.params.id, `Resubmitted — ${quantity} ${unit}`]
    );
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /api/compounds/:id/approve  (admin only)
router.patch('/:id/approve', requireRole('admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      UPDATE compounds
      SET status = 'approved', approved_by = $1, approved_at = NOW()
      WHERE id = $2 AND status = 'pending'
      RETURNING *
    `, [req.user.id, req.params.id]);

    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Compound not found or not pending' });
    }
    await client.query(
      `INSERT INTO activity_log (user_id, action, compound_id) VALUES ($1, 'approved', $2)`,
      [req.user.id, req.params.id]
    );
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /api/compounds/:id/reject  (admin only)
router.patch('/:id/reject', requireRole('admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { note } = req.body;
    if (!note) return res.status(400).json({ message: 'Rejection note required' });

    await client.query('BEGIN');
    const { rows } = await client.query(`
      UPDATE compounds
      SET status = 'rejected', rejected_by = $1, rejected_at = NOW(), rejection_note = $2
      WHERE id = $3 AND status = 'pending'
      RETURNING *
    `, [req.user.id, note, req.params.id]);

    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Compound not found or not pending' });
    }
    await client.query(
      `INSERT INTO activity_log (user_id, action, compound_id, notes) VALUES ($1, 'rejected', $2, $3)`,
      [req.user.id, req.params.id, note]
    );
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /api/compounds/:id/bud  (admin only)
router.patch('/:id/bud', requireRole('admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { bud, reason } = req.body;
    if (!bud || !reason) {
      return res.status(400).json({ message: 'New BUD date and reason required' });
    }
    await client.query('BEGIN');
    const { rows } = await client.query(`
      UPDATE compounds
      SET bud = $1, bud_override_reason = $2,
          bud_overridden_by = $3, bud_overridden_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [bud, reason, req.user.id, req.params.id]);

    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Compound not found' });
    }
    await client.query(
      `INSERT INTO activity_log (user_id, action, compound_id, notes) VALUES ($1, 'adjusted_bud', $2, $3)`,
      [req.user.id, req.params.id, reason]
    );
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
