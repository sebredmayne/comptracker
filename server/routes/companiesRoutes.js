/**
 * Express routes for companies management and digest generation.
 */

const express      = require('express');
const companiesDb  = require('../db/companiesDb');
const { buildDigest } = require('../trackers/digestBuilder');

const router = express.Router();

// GET /api/companies — list all companies
router.get('/companies', (req, res) => {
  try {
    const companies = companiesDb.getAllCompanies();
    res.json({ companies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/companies — add a company
router.post('/companies', (req, res) => {
  try {
    const company = companiesDb.addCompany(req.body);
    res.status(201).json({ company });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A company with that name already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/companies/:id — update a company
router.put('/companies/:id', (req, res) => {
  try {
    const company = companiesDb.updateCompany(Number(req.params.id), req.body);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    res.json({ company });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/companies/:id — delete a company
router.delete('/companies/:id', (req, res) => {
  try {
    const existing = companiesDb.getCompany(Number(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Company not found' });
    companiesDb.deleteCompany(Number(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/digest/:company — generate (or return cached) digest
router.get('/digest/:company', async (req, res) => {
  try {
    const days   = parseInt(req.query.days) || 7;
    const digest = await buildDigest(req.params.company, days);
    if (digest.error) return res.status(404).json({ error: digest.error });
    res.json({ digest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/digest/:company/text — return plain-text summary
router.get('/digest/:company/text', async (req, res) => {
  try {
    const days   = parseInt(req.query.days) || 7;
    const digest = await buildDigest(req.params.company, days);
    if (digest.error) return res.status(404).json({ error: digest.error });
    res.type('text/plain').send(digest.summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
