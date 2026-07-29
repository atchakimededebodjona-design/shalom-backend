const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { registerAndVerify } = require('./helpers');

const PREFIX = 'test-jest-billing-';
const user = { email: `${PREFIX}user@shalom.dev`, password: 'Password123!', display_name: 'Billing Tester' };

let token;
let clientId;
let invoiceId;

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('Module Billing (Reçu+)', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
    const { verifyRes: res } = await registerAndVerify(user);
    token = res.body.data.tokens.access_token;
  });

  afterAll(async () => {
    // businesses/clients/invoices/payments ont ON DELETE CASCADE sur user_id/business_id :
    // supprimer le compte suffit à tout nettoyer.
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
  });

  describe('Entreprise', () => {
    it("refuse d'accéder aux clients sans entreprise (404)", async () => {
      const res = await request(app).get('/api/v1/billing/clients').set(auth());
      expect(res.statusCode).toBe(404);
      expect(res.body.code).toBe('BUSINESS_NOT_FOUND');
    });

    it('crée une entreprise', async () => {
      const res = await request(app).post('/api/v1/billing/businesses').set(auth())
        .send({ name: 'Atelier Test' });
      expect(res.statusCode).toBe(201);
      expect(res.body.data.business.name).toBe('Atelier Test');
      expect(res.body.data.business.invoice_prefix).toBe('FAC');
    });

    it('refuse une deuxième entreprise (409)', async () => {
      const res = await request(app).post('/api/v1/billing/businesses').set(auth())
        .send({ name: 'Autre Entreprise' });
      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe('BUSINESS_ALREADY_EXISTS');
    });

    it('récupère mon entreprise', async () => {
      const res = await request(app).get('/api/v1/billing/businesses/me').set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.business.name).toBe('Atelier Test');
    });

    it('met à jour mon entreprise', async () => {
      const res = await request(app).patch('/api/v1/billing/businesses/me').set(auth())
        .send({ phone: '+22890000000' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.business.phone).toBe('+22890000000');
    });
  });

  describe('Clients', () => {
    it('crée un client', async () => {
      const res = await request(app).post('/api/v1/billing/clients').set(auth())
        .send({ name: 'Client Jest', email: 'client.jest@example.com', phone: '+22890000000' });
      expect(res.statusCode).toBe(201);
      clientId = res.body.data.client.id;
      expect(clientId).toBeDefined();
    });

    it('liste les clients', async () => {
      const res = await request(app).get('/api/v1/billing/clients').set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.clients.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.pagination.total_count).toBeGreaterThanOrEqual(1);
    });

    it('refuse un nom vide (400)', async () => {
      const res = await request(app).post('/api/v1/billing/clients').set(auth()).send({ name: '' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Factures et paiements', () => {
    it('crée une facture avec calcul correct des totaux', async () => {
      const res = await request(app).post('/api/v1/billing/invoices').set(auth())
        .send({
          client_id: clientId,
          tax_rate: 18,
          items: [{ description: 'Prestation', quantity: 2, unit_price: 5000 }],
        });
      expect(res.statusCode).toBe(201);
      invoiceId = res.body.data.invoice.id;
      expect(res.body.data.invoice.subtotal).toBe(10000);
      expect(res.body.data.invoice.tax_amount).toBe(1800);
      expect(res.body.data.invoice.total).toBe(11800);
      expect(res.body.data.invoice.status).toBe('draft');
    });

    it('refuse une facture sans article (400)', async () => {
      const res = await request(app).post('/api/v1/billing/invoices').set(auth())
        .send({ client_id: clientId, items: [] });
      expect(res.statusCode).toBe(400);
    });

    it('enregistre un paiement partiel et met à jour le statut', async () => {
      const res = await request(app).post(`/api/v1/billing/invoices/${invoiceId}/payments`).set(auth())
        .send({ amount: 5000, payment_method: 'mobile_money' });
      expect(res.statusCode).toBe(201);
      expect(res.body.data.payment.amount).toBe(5000);

      const invoiceRes = await request(app).get(`/api/v1/billing/invoices/${invoiceId}`).set(auth());
      expect(invoiceRes.body.data.invoice.status).toBe('partial');
      expect(invoiceRes.body.data.invoice.amount_paid).toBe(5000);
    });

    it('crédite le portefeuille SHALOM du propriétaire au paiement', async () => {
      const walletRes = await request(app).get('/api/v1/wallet').set(auth());
      expect(walletRes.statusCode).toBe(200);
      expect(Number(walletRes.body.data.wallet.balance)).toBeGreaterThanOrEqual(5000);

      const txRes = await request(app).get('/api/v1/wallet/transactions?source=invoice').set(auth());
      expect(txRes.statusCode).toBe(200);
      expect(txRes.body.data.transactions.some((t) => t.reference_id === invoiceId)).toBe(true);
    });

    it('refuse un paiement qui dépasse le solde dû (400)', async () => {
      const res = await request(app).post(`/api/v1/billing/invoices/${invoiceId}/payments`).set(auth())
        .send({ amount: 999999 });
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('PAYMENT_EXCEEDS_DUE');
    });

    it('solde la facture avec le paiement restant (passe "paid")', async () => {
      const res = await request(app).post(`/api/v1/billing/invoices/${invoiceId}/payments`).set(auth())
        .send({ amount: 6800 });
      expect(res.statusCode).toBe(201);

      const invoiceRes = await request(app).get(`/api/v1/billing/invoices/${invoiceId}`).set(auth());
      expect(invoiceRes.body.data.invoice.status).toBe('paid');
      expect(invoiceRes.body.data.invoice.amount_paid).toBe(11800);
    });

    it("génère une page HTML imprimable de la facture", async () => {
      const res = await request(app).get(`/api/v1/billing/invoices/${invoiceId}/print`).set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('Atelier Test');
      expect(res.text).toContain('Client Jest');
      expect(res.text).toMatch(/Facture FAC-\d{4}-\d{4}/);
    });

    it('génère un lien WhatsApp pré-rempli avec un lien public', async () => {
      const res = await request(app).get(`/api/v1/billing/invoices/${invoiceId}/whatsapp-link`).set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.whatsapp_url).toMatch(/^https:\/\/wa\.me\/22890000000\?text=/);
      expect(res.body.data.public_url).toMatch(/\/api\/v1\/billing\/public\/invoices\//);
    });

    it("le lien public d'impression fonctionne sans authentification", async () => {
      const linkRes = await request(app).get(`/api/v1/billing/invoices/${invoiceId}/whatsapp-link`).set(auth());
      const publicRes = await request(app).get(new URL(linkRes.body.data.public_url).pathname);
      expect(publicRes.statusCode).toBe(200);
      expect(publicRes.text).toContain('Atelier Test');
    });

    it('refuse un jeton de partage invalide (400 validation)', async () => {
      const res = await request(app).get('/api/v1/billing/public/invoices/not-a-uuid');
      expect(res.statusCode).toBe(400);
    });

    it("refuse l'accès aux factures d'un autre utilisateur", async () => {
      const other = { email: `${PREFIX}other@shalom.dev`, password: 'Password123!', display_name: 'Autre' };
      const { verifyRes: otherRes } = await registerAndVerify(other);
      const otherToken = otherRes.body.data.tokens.access_token;

      const res = await request(app).get(`/api/v1/billing/invoices/${invoiceId}`)
        .set({ Authorization: `Bearer ${otherToken}` });
      // L'autre utilisateur n'a pas d'entreprise → 404 BUSINESS_NOT_FOUND, jamais la facture d'autrui
      expect(res.statusCode).toBe(404);
    });
  });
});
