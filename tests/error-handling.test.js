// tests/error-handling.test.js
// Tests unitaires (sans DB) du contrôleur reports : vérifie qu'une erreur
// serveur inattendue ne renvoie jamais err.stack (ni aucun autre détail
// interne) au client. cf. audit sécurité — reports.controller.js exposait
// autrefois `detail: err.stack` sur updateReport.

const reportsController = require('../src/modules/reports/reports.controller');
const reportsService = require('../src/modules/reports/reports.service');

const buildRes = () => {
  const res = { statusCode: null, body: null };
  res.status = function (code) { this.statusCode = code; return this; };
  res.json = function (body) { this.body = body; return this; };
  return res;
};

describe('reports.controller — pas de fuite de détails internes', () => {
  it('updateReport ne renvoie pas err.stack ni err.message brut sur une erreur inattendue', async () => {
    const original = reportsService.updateReportStatus;
    reportsService.updateReportStatus = jest.fn().mockRejectedValue(
      new Error('relation "secret_table" does not exist at /app/src/db/query.js:42')
    );

    const req = {
      params: { id: '00000000-0000-0000-0000-000000000000' },
      body: { status: 'traite', apply_action: false },
      user: { id: 'admin-fake-id' },
    };
    const res = buildRes();

    await reportsController.updateReport(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).not.toHaveProperty('detail');
    expect(res.body).not.toHaveProperty('stack');
    expect(JSON.stringify(res.body)).not.toMatch(/secret_table|\.js:\d+/);
    expect(res.body.code).toBe('INTERNAL_ERROR');

    reportsService.updateReportStatus = original;
  });
});
