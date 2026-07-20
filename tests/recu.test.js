// tests/recu.test.js
// Tests d'intégration HTTP du module « Reçu+ » (Facturation), au même format que
// les autres suites (supertest). Couvre les deux sous-modules :
//   - Clients  (/api/v1/clients)   : CRUD, recherche, soft delete, cloisonnement.
//   - Factures (/api/v1/invoices)  : création avec totaux calculés côté serveur,
//     numéro unique, aperçu, et surtout le PAIEMENT qui crédite le portefeuille
//     SHALOM (source 'invoice') dans la même transaction.
//
// NB (cf. mémoire projet) : les tests tournent sur la même base Supabase que le
// dev. On isole par préfixe d'email et on nettoie en beforeAll/afterAll — la
// suppression de l'utilisateur cascade sur billing_clients / billing_invoices /
// billing_invoice_items / billing_payments et sur le portefeuille.

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const PREFIX = 'test-jest-recu-';
const owner = {
  email: `${PREFIX}owner@shalom.dev`,
  password: 'Password123!',
  display_name: 'Recu Owner',
};
const other = {
  email: `${PREFIX}other@shalom.dev`,
  password: 'Password123!',
  display_name: 'Recu Other',
};

let token; // propriétaire des factures/clients
let otherToken; // second utilisateur (test de cloisonnement)

let clientId; // client principal réutilisé pour les factures
let invoiceId; // facture principale (payée par étapes)

const auth = (t = token) => ({ Authorization: `Bearer ${t}` });
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

const cleanup = async () => {
  // Tout cascade depuis users (billing_* et wallet_* en ON DELETE CASCADE).
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${PREFIX}%`]);
};

const walletBalance = async (t = token) => {
  const res = await request(app).get('/api/v1/wallet').set(auth(t));
  return Number(res.body.data.wallet.balance);
};

describe('Module Reçu+ (Facturation)', () => {
  beforeAll(async () => {
    await cleanup();
    const r1 = await request(app).post('/api/v1/auth/register').send(owner);
    token = r1.body.data.tokens.access_token;
    const r2 = await request(app).post('/api/v1/auth/register').send(other);
    otherToken = r2.body.data.tokens.access_token;
  });

  afterAll(async () => {
    await cleanup();
  });

  // =======================================================================
  // Clients
  // =======================================================================
  describe('Clients', () => {
    it('refuse sans token (401)', async () => {
      const res = await request(app).get('/api/v1/clients');
      expect(res.statusCode).toBe(401);
    });

    it("part d'une liste vide", async () => {
      const res = await request(app).get('/api/v1/clients').set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.clients).toEqual([]);
    });

    it('crée un client (201)', async () => {
      const res = await request(app).post('/api/v1/clients').set(auth())
        .send({ name: 'Paroisse Saint-Michel', email: 'contact@stmichel.dev', phone: '+22990000000' });
      expect(res.statusCode).toBe(201);
      expect(res.body.data.client.name).toBe('Paroisse Saint-Michel');
      expect(res.body.data.client.id).toBeDefined();
      clientId = res.body.data.client.id;
    });

    it('refuse un client sans nom (400)', async () => {
      const res = await request(app).post('/api/v1/clients').set(auth()).send({ email: 'x@y.dev' });
      expect(res.statusCode).toBe(400);
    });

    it('refuse un email invalide (400)', async () => {
      const res = await request(app).post('/api/v1/clients').set(auth())
        .send({ name: 'Client', email: 'pas-un-email' });
      expect(res.statusCode).toBe(400);
    });

    it('liste le client créé', async () => {
      const res = await request(app).get('/api/v1/clients').set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.clients.some((c) => c.id === clientId)).toBe(true);
    });

    it('filtre par ?search=', async () => {
      const hit = await request(app).get('/api/v1/clients?search=Michel').set(auth());
      expect(hit.body.data.clients.some((c) => c.id === clientId)).toBe(true);
      const miss = await request(app).get('/api/v1/clients?search=zzz-introuvable').set(auth());
      expect(miss.body.data.clients.some((c) => c.id === clientId)).toBe(false);
    });

    it('récupère le détail (GET /:id)', async () => {
      const res = await request(app).get(`/api/v1/clients/${clientId}`).set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.client.email).toBe('contact@stmichel.dev');
    });

    it('met à jour le client (PATCH)', async () => {
      const res = await request(app).patch(`/api/v1/clients/${clientId}`).set(auth())
        .send({ phone: '+22991111111' });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.client.phone).toBe('+22991111111');
    });

    it('renvoie 404 pour un client inexistant', async () => {
      const res = await request(app).get(`/api/v1/clients/${NIL_UUID}`).set(auth());
      expect(res.statusCode).toBe(404);
      expect(res.body.code).toBe('CLIENT_NOT_FOUND');
    });

    it('renvoie 400 pour un id non-UUID', async () => {
      const res = await request(app).get('/api/v1/clients/pas-un-uuid').set(auth());
      expect(res.statusCode).toBe(400);
    });

    it("cloisonne : un autre utilisateur ne voit pas le client (404)", async () => {
      const res = await request(app).get(`/api/v1/clients/${clientId}`).set(auth(otherToken));
      expect(res.statusCode).toBe(404);
    });

    it('supprime (soft delete) un client dédié puis renvoie 404', async () => {
      const created = await request(app).post('/api/v1/clients').set(auth()).send({ name: 'À supprimer' });
      const idToDelete = created.body.data.client.id;

      const del = await request(app).delete(`/api/v1/clients/${idToDelete}`).set(auth());
      expect(del.statusCode).toBe(200);

      const after = await request(app).get(`/api/v1/clients/${idToDelete}`).set(auth());
      expect(after.statusCode).toBe(404);

      const list = await request(app).get('/api/v1/clients').set(auth());
      expect(list.body.data.clients.some((c) => c.id === idToDelete)).toBe(false);
    });
  });

  // =======================================================================
  // Factures — création, totaux serveur, aperçu
  // =======================================================================
  describe('Factures', () => {
    it("aperçu vide avant toute facture", async () => {
      const res = await request(app).get('/api/v1/invoices/overview').set(auth());
      expect(res.statusCode).toBe(200);
      const o = res.body.data.overview;
      expect(o.invoices_count).toBe(0);
      expect(Number(o.total_invoiced)).toBe(0);
      expect(Number(o.total_paid)).toBe(0);
      expect(Number(o.total_outstanding)).toBe(0);
    });

    it('refuse sans token (401)', async () => {
      const res = await request(app).get('/api/v1/invoices');
      expect(res.statusCode).toBe(401);
    });

    it('crée une facture et calcule les totaux côté serveur', async () => {
      const res = await request(app).post('/api/v1/invoices').set(auth()).send({
        invoice_number: 'FA-TEST-001',
        client_id: clientId,
        tax_rate: 18,
        items: [
          { description: 'Consultation', quantity: 2, unit_price: 10000 },
          { description: 'Support', quantity: 1, unit_price: 5000 },
        ],
      });
      expect(res.statusCode).toBe(201);
      const inv = res.body.data.invoice;
      expect(Number(inv.subtotal)).toBe(25000); // 2*10000 + 1*5000
      expect(Number(inv.tax_amount)).toBe(4500); // 25000 * 18%
      expect(Number(inv.total)).toBe(29500);
      expect(Number(inv.amount_paid)).toBe(0);
      expect(inv.status).toBe('draft');
      expect(inv.client_id).toBe(clientId);
      expect(inv.items).toHaveLength(2);
      invoiceId = inv.id;
    });

    it('ignore les totaux envoyés par le client (recalcul serveur)', async () => {
      const res = await request(app).post('/api/v1/invoices').set(auth()).send({
        invoice_number: 'FA-TEST-TRUST',
        total: 1, subtotal: 1, tax_amount: 1, // valeurs malveillantes ignorées
        items: [{ description: 'Item', quantity: 3, unit_price: 1000 }],
      });
      expect(res.statusCode).toBe(201);
      expect(Number(res.body.data.invoice.total)).toBe(3000);
    });

    it('refuse une facture sans ligne (400)', async () => {
      const res = await request(app).post('/api/v1/invoices').set(auth())
        .send({ invoice_number: 'FA-TEST-EMPTY', items: [] });
      expect(res.statusCode).toBe(400);
    });

    it('refuse une quantité <= 0 (400)', async () => {
      const res = await request(app).post('/api/v1/invoices').set(auth()).send({
        invoice_number: 'FA-TEST-QTY',
        items: [{ description: 'X', quantity: 0, unit_price: 1000 }],
      });
      expect(res.statusCode).toBe(400);
    });

    it('refuse un numéro de facture dupliqué (409 DUPLICATE_ENTRY)', async () => {
      const res = await request(app).post('/api/v1/invoices').set(auth()).send({
        invoice_number: 'FA-TEST-001', // déjà utilisé
        items: [{ description: 'X', quantity: 1, unit_price: 1000 }],
      });
      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe('DUPLICATE_ENTRY');
    });

    it('liste la facture avec le nom du client (jointure)', async () => {
      const res = await request(app).get('/api/v1/invoices').set(auth());
      expect(res.statusCode).toBe(200);
      const found = res.body.data.invoices.find((i) => i.id === invoiceId);
      expect(found).toBeDefined();
      expect(found.client_name).toBe('Paroisse Saint-Michel');
    });

    it('filtre par ?status=', async () => {
      const draft = await request(app).get('/api/v1/invoices?status=draft').set(auth());
      expect(draft.body.data.invoices.some((i) => i.id === invoiceId)).toBe(true);
      const paid = await request(app).get('/api/v1/invoices?status=paid').set(auth());
      expect(paid.body.data.invoices.some((i) => i.id === invoiceId)).toBe(false);
    });

    it('récupère le détail avec lignes et paiements (GET /:id)', async () => {
      const res = await request(app).get(`/api/v1/invoices/${invoiceId}`).set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.invoice.items).toHaveLength(2);
      expect(res.body.data.invoice.payments).toEqual([]);
    });

    it('renvoie 404 pour une facture inexistante', async () => {
      const res = await request(app).get(`/api/v1/invoices/${NIL_UUID}`).set(auth());
      expect(res.statusCode).toBe(404);
      expect(res.body.code).toBe('INVOICE_NOT_FOUND');
    });

    it('renvoie 400 pour un id non-UUID', async () => {
      const res = await request(app).get('/api/v1/invoices/pas-un-uuid').set(auth());
      expect(res.statusCode).toBe(400);
    });

    it("cloisonne : un autre utilisateur ne voit pas la facture (404)", async () => {
      const res = await request(app).get(`/api/v1/invoices/${invoiceId}`).set(auth(otherToken));
      expect(res.statusCode).toBe(404);
    });
  });

  // =======================================================================
  // Paiements — crédite le portefeuille SHALOM (le cœur du module)
  // =======================================================================
  describe('Paiements (crédit du portefeuille)', () => {
    it('portefeuille du propriétaire à 0 avant paiement', async () => {
      expect(await walletBalance()).toBe(0);
    });

    it('refuse un montant <= 0 (400)', async () => {
      const res = await request(app).post(`/api/v1/invoices/${invoiceId}/payments`).set(auth())
        .send({ amount: 0 });
      expect(res.statusCode).toBe(400);
    });

    it('refuse un paiement sur une facture inexistante (404)', async () => {
      const res = await request(app).post(`/api/v1/invoices/${NIL_UUID}/payments`).set(auth())
        .send({ amount: 1000 });
      expect(res.statusCode).toBe(404);
    });

    it('enregistre un paiement partiel → statut partially_paid', async () => {
      const res = await request(app).post(`/api/v1/invoices/${invoiceId}/payments`).set(auth())
        .send({ amount: 10000, method: 'cash' });
      expect(res.statusCode).toBe(201);
      expect(res.body.data.invoice.status).toBe('partially_paid');
      expect(Number(res.body.data.invoice.amount_paid)).toBe(10000);
    });

    it('a crédité le portefeuille de 10000 (mouvement source=invoice)', async () => {
      expect(await walletBalance()).toBe(10000);
      const res = await request(app).get('/api/v1/wallet').set(auth());
      const tx = res.body.data.transactions.find((t) => t.source === 'invoice');
      expect(tx).toBeDefined();
      expect(tx.type).toBe('credit');
      expect(Number(tx.amount)).toBe(10000);
    });

    it('solde le reste → statut paid et amount_paid == total', async () => {
      const res = await request(app).post(`/api/v1/invoices/${invoiceId}/payments`).set(auth())
        .send({ amount: 19500, method: 'mobile_money' });
      expect(res.statusCode).toBe(201);
      expect(res.body.data.invoice.status).toBe('paid');
      expect(Number(res.body.data.invoice.amount_paid)).toBe(29500);
    });

    it('a crédité le portefeuille du total (10000 + 19500 = 29500)', async () => {
      expect(await walletBalance()).toBe(29500);
    });

    it('liste les deux reçus de la facture', async () => {
      const res = await request(app).get(`/api/v1/invoices/${invoiceId}/payments`).set(auth());
      expect(res.statusCode).toBe(200);
      expect(res.body.data.payments).toHaveLength(2);
    });

    it("aperçu après paiement : encaissé = 29500, restant dû = 3000 (FA-TEST-TRUST non soldée)", async () => {
      // Deux factures existent : FA-TEST-001 (29500, soldée) et FA-TEST-TRUST (3000, impayée).
      const res = await request(app).get('/api/v1/invoices/overview').set(auth());
      const o = res.body.data.overview;
      expect(o.invoices_count).toBe(2);
      expect(Number(o.total_invoiced)).toBe(32500);
      expect(Number(o.total_paid)).toBe(29500);
      expect(Number(o.total_outstanding)).toBe(3000);
    });
  });

  // =======================================================================
  // Mise à jour / annulation / suppression
  // =======================================================================
  describe('Mise à jour, annulation et suppression', () => {
    let draftId;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/invoices').set(auth()).send({
        invoice_number: 'FA-TEST-002',
        tax_rate: 0,
        items: [{ description: 'Prestation', quantity: 1, unit_price: 40000 }],
      });
      draftId = res.body.data.invoice.id;
    });

    it('recalcule le total quand tax_rate change (PATCH)', async () => {
      const res = await request(app).patch(`/api/v1/invoices/${draftId}`).set(auth())
        .send({ tax_rate: 10 });
      expect(res.statusCode).toBe(200);
      expect(Number(res.body.data.invoice.total)).toBe(44000); // 40000 + 10%
    });

    it('refuse un paiement sur une facture annulée (409 INVOICE_CANCELLED)', async () => {
      const cancel = await request(app).patch(`/api/v1/invoices/${draftId}`).set(auth())
        .send({ status: 'cancelled' });
      expect(cancel.statusCode).toBe(200);

      const pay = await request(app).post(`/api/v1/invoices/${draftId}/payments`).set(auth())
        .send({ amount: 1000 });
      expect(pay.statusCode).toBe(409);
      expect(pay.body.code).toBe('INVOICE_CANCELLED');
    });

    it('supprime (soft delete) une facture puis renvoie 404', async () => {
      const del = await request(app).delete(`/api/v1/invoices/${draftId}`).set(auth());
      expect(del.statusCode).toBe(200);
      const after = await request(app).get(`/api/v1/invoices/${draftId}`).set(auth());
      expect(after.statusCode).toBe(404);
    });
  });
});
