const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../database/db');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

const SLA_HOURS = {
  'COD Dispute':        24,
  'Late Delivery':      48,
  'Damaged Parcel':     24,
  'Missing Parcel':     48,
  'Wrong Address':      48,
  'System Error':        4,
  'Customer Complaint': 72,
  'Other':              72,
};

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => {
    const prefix = Date.now();
    cb(null, `${prefix}_${file.originalname.replace(/\s+/g, '_')}`);
  },
});

const ALLOWED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
];

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Unsupported file type'));
  },
});

function mimeToContentType(mime) {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.includes('wordprocessing')) return 'docx';
  if (mime.startsWith('image/')) return 'image';
  return 'text';
}

router.post('/file', auth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const { filename, path: filePath, mimetype } = req.file;
    const contentType = mimeToContentType(mimetype);
    const result = db.prepare(`
      INSERT INTO raw_inputs (filename, file_path, source_type, content_type, processing_status)
      VALUES (?, ?, 'manual', ?, 'pending')
    `).run(filename, `/uploads/${filename}`, contentType);

    res.json({ id: result.lastInsertRowid, filename, status: 'pending' });
  });
});

router.post('/text', auth, (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required' });

  const result = db.prepare(`
    INSERT INTO raw_inputs (source_type, content_type, raw_text, processing_status)
    VALUES ('text_paste', 'text', ?, 'pending')
  `).run(text.trim());

  res.json({ id: result.lastInsertRowid, status: 'pending' });
});

router.post('/uipath', (req, res) => {
  const { raw_input_ids, structured_incident, ocr_confidence, error } = req.body;

  if (error) {
    if (raw_input_ids && raw_input_ids.length) {
      const update = db.prepare(
        `UPDATE raw_inputs SET processing_status='failed', error_message=? WHERE id=?`
      );
      for (const id of raw_input_ids) update.run(error, id);
    }
    return res.json({ message: 'Error logged' });
  }

  const si = structured_incident;
  if (!si) return res.status(400).json({ error: 'structured_incident required' });

  const slaHours = SLA_HOURS[si.category] || 72;
  const now = Math.floor(Date.now() / 1000);
  const slaDeadline = now + slaHours * 3600;

  const countRow = db.prepare("SELECT COUNT(*) as c FROM incidents").get();
  const seq = String(countRow.c + 1).padStart(4, '0');
  const year = new Date().getFullYear();
  const incidentRef = `INC-${year}-${seq}`;

  const incResult = db.prepare(`
    INSERT INTO incidents (
      incident_ref, title, summary, category, severity, status,
      primary_department, root_cause_suggestion, llm_confidence,
      is_duplicate, duplicate_reason, sla_hours, sla_deadline, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'New', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    incidentRef, si.title, si.summary, si.category, si.severity,
    si.primary_department, si.root_cause_suggestion,
    si.confidence || null,
    si.is_duplicate_likely ? 1 : 0,
    si.duplicate_reason || null,
    slaHours, slaDeadline, now, now
  );

  const incidentId = incResult.lastInsertRowid;

  db.prepare(`
    INSERT INTO department_tasks (incident_id, department, role, task_description)
    VALUES (?, ?, 'primary', ?)
  `).run(incidentId, si.primary_department, `Handle ${si.category} incident as primary owner.`);

  if (si.supporting_departments && Array.isArray(si.supporting_departments)) {
    for (const sup of si.supporting_departments) {
      db.prepare(`
        INSERT INTO department_tasks (incident_id, department, role, task_description)
        VALUES (?, ?, 'supporting', ?)
      `).run(incidentId, sup.department, sup.task);
    }
  }

  if (raw_input_ids && raw_input_ids.length) {
    const updateRaw = db.prepare(`
      UPDATE raw_inputs SET processing_status='processed', incident_id=?, processed_at=?, ocr_confidence=?
      WHERE id=?
    `);
    for (const id of raw_input_ids) {
      updateRaw.run(incidentId, now, ocr_confidence || null, id);
    }
  }

  db.prepare(`
    INSERT INTO audit_trail (incident_id, actor, action, new_value, notes)
    VALUES (?, 'UiPath', 'Incident created by automation', 'New', ?)
  `).run(incidentId, `Confidence: ${si.confidence || 'N/A'}`);

  res.json({ incident_id: incidentId, incident_ref: incidentRef });
});

router.patch('/:id/status', auth, (req, res) => {
  const { id } = req.params;
  const { processing_status } = req.body;
  const valid = ['pending', 'processing', 'processed', 'failed'];
  if (!valid.includes(processing_status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  db.prepare('UPDATE raw_inputs SET processing_status=? WHERE id=?').run(processing_status, id);
  res.json({ message: 'Updated' });
});

router.get('/queue', auth, (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT id, filename, source_type, content_type, processing_status,
           uploaded_at, processed_at, error_message, incident_id
    FROM raw_inputs
  `;
  const rows = status
    ? db.prepare(query + ' WHERE processing_status = ? ORDER BY uploaded_at DESC').all(status)
    : db.prepare(query + ' ORDER BY uploaded_at DESC').all();
  res.json(rows);
});

module.exports = router;
