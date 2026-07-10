const { pool } = require('../../config/db');

class ReportsService {
  async createReport(reporterId, data) {
    const { target_type, target_id, reason, details } = data;

    // Vérifier si l'utilisateur a déjà signalé ce contenu
    const checkDuplicate = await pool.query(
      `SELECT id FROM reports 
       WHERE reporter_id = $1 AND target_type = $2 AND target_id = $3`,
      [reporterId, target_type, target_id]
    );

    if (checkDuplicate.rows.length > 0) {
      const error = new Error("Vous avez déjà signalé ce contenu");
      error.code = 'REPORT_ALREADY_EXISTS';
      throw error;
    }

    const result = await pool.query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason, details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [reporterId, target_type, target_id, reason, details]
    );

    return result.rows[0];
  }

  async getReports(filters, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const values = [];
    let queryStr = `
      SELECT r.*, 
             u.email as reporter_email, 
             p.display_name as reporter_name 
      FROM reports r
      JOIN users u ON r.reporter_id = u.id
      JOIN profiles p ON r.reporter_id = p.user_id
    `;
    let countQueryStr = `SELECT COUNT(*) FROM reports r`;

    if (filters.status) {
      queryStr += ` WHERE r.status = $1`;
      countQueryStr += ` WHERE r.status = $1`;
      values.push(filters.status);
    }

    queryStr += ` ORDER BY r.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    
    const countResult = await pool.query(countQueryStr, values);
    const total = parseInt(countResult.rows[0].count);
    
    const dataValues = [...values, limit, offset];
    const result = await pool.query(queryStr, dataValues);

    return {
      reports: result.rows,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async updateReportStatus(reportId, status, applyAction, adminId) {
    // 1. Récupérer le signalement
    const reportResult = await pool.query('SELECT * FROM reports WHERE id = $1', [reportId]);
    if (reportResult.rows.length === 0) {
      const error = new Error("Signalement introuvable");
      error.code = 'REPORT_NOT_FOUND';
      throw error;
    }

    const report = reportResult.rows[0];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 2. Mettre à jour le signalement
      const updateResult = await client.query(
        `UPDATE reports 
         SET status = $1, handled_by = $2, resolved_at = now() 
         WHERE id = $3 
         RETURNING *`,
        [status, adminId, reportId]
      );

      // 3. Appliquer l'action si demandée et que le statut est 'traite'
      if (applyAction && status === 'traite') {
        const table = report.target_type === 'post' ? 'posts' : 'comments';
        await client.query(
          `UPDATE ${table} SET status = 'masque' WHERE id = $1`,
          [report.target_id]
        );
      }

      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new ReportsService();
