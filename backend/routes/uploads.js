const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../database/db');
const auth = require('../middleware/authMiddleware');
const router = express.Router();
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const mammoth = require('mammoth');
const fs = require('fs');

const getSLAHours = (severity, category) => {
  if (severity === 'Critical') return 6;
  if (severity === 'High')     return 24;
  const CATEGORY_SLA = {
    'System Error': 4, 'COD Dispute': 24, 'Damaged Parcel': 24,
    'Late Delivery': 48, 'Missing Parcel': 48, 'Wrong Address': 48,
    'Customer Complaint': 72, 'Other': 72,
  };
  return CATEGORY_SLA[category] || 72;
};

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`);
  },
});

const ALLOWED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/jpg', 'image/png', 'text/plain',
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
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const { filename, mimetype, path: tempPath } = req.file;
    const contentType = mimeToContentType(mimetype);
    const filePath = path.join(__dirname, '..', 'uploads', filename);
    let rawText = null;
    try {
      if (contentType === 'text') {
        rawText = fs.readFileSync(tempPath, 'utf8');
      } else if (contentType === 'pdf') {
        const buffer = fs.readFileSync(tempPath);
        const data = await pdfParse(buffer);
        rawText = data.text;
      } else if (contentType === 'docx') {
        const result = await mammoth.extractRawText({ path: tempPath });
        rawText = result.value;
      }
    } catch (e) {
      console.warn('[File extraction error]', e.message);
    }
    const result = await db.prepare(`
      INSERT INTO raw_inputs (filename, file_path, source_type, content_type, raw_text, processing_status)
      VALUES (?, ?, 'manual', ?, ?, 'pending')
    `).run(filename, filePath, contentType, rawText);
    res.json({ id: result.lastInsertRowid, filename, status: 'pending' });
  });
});

router.post('/text', auth, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required' });
  const result = await db.prepare(`
    INSERT INTO raw_inputs (source_type, content_type, raw_text, processing_status)
    VALUES ('text_paste', 'text', ?, 'pending')
  `).run(text.trim());
  res.json({ id: result.lastInsertRowid, status: 'pending' });
});

router.post('/uipath', async (req, res) => {
  const { raw_input_ids, structured_incident, ocr_confidence, detected_language, missing_fields, error } = req.body;

  if (error) {
    if (raw_input_ids && raw_input_ids.length) {
      for (const id of raw_input_ids) {
        await db.prepare(`UPDATE raw_inputs SET processing_status='failed', error_message=? WHERE id=?`).run(error, id);
      }
    }
    return res.json({ message: 'Error logged' });
  }

  const si = structured_incident;
  if (!si) return res.status(400).json({ error: 'structured_incident required' });

  const slaHours = getSLAHours(si.severity, si.category);
  const now = Math.floor(Date.now() / 1000);
  const slaDeadline = now + slaHours * 3600;

  const countRow = await db.prepare("SELECT COUNT(*) as c FROM incidents").get();
  const seq = String(parseInt(countRow.c) + 1).padStart(4, '0');
  const incidentRef = `INC-${new Date().getFullYear()}-${seq}`;

  const initialStatus = si.is_duplicate_likely ? 'Pending' : 'New';

  const incResult = await db.prepare(`
    INSERT INTO incidents (
      incident_ref, title, summary, category, severity, status,
      primary_department,
      root_cause_suggestion, root_cause_hypothesis, root_cause_evidence, root_cause_confidence,
      llm_confidence, sentiment_score,
      is_duplicate, duplicate_reason, processed_via_fallback,
      sla_hours, sla_deadline, sla_state,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ON_TRACK', ?, ?)
  `).run(
    incidentRef, si.title, si.summary, si.category, si.severity,
    initialStatus,
    si.primary_department,
    si.root_cause_hypothesis || si.root_cause_suggestion || null,
    si.root_cause_hypothesis || null,
    si.root_cause_evidence || null,
    si.root_cause_confidence != null ? si.root_cause_confidence : null,
    si.llm_confidence || si.confidence || null,
    si.sentiment_score || null,
    si.is_duplicate_likely ? 1 : 0,
    si.duplicate_reason || null,
    si.processed_via_fallback ? 1 : 0,
    slaHours, slaDeadline, now, now
  );

  const incidentId = incResult.lastInsertRowid;

  const primaryPS = si.problem_statement || `Handle ${si.category} incident.`;
  const primaryAR = si.action_required || `Investigate and resolve as primary owner.`;
  const primaryEO = si.expected_output || `Resolution report and closure confirmation.`;

  await db.prepare(`
    INSERT INTO department_tasks
      (incident_id, department, role, task_description, problem_statement, action_required, expected_output)
    VALUES (?, ?, 'primary', ?, ?, ?, ?)
  `).run(incidentId, si.primary_department, primaryAR, primaryPS, primaryAR, primaryEO);

  if (si.supporting_departments && Array.isArray(si.supporting_departments)) {
    for (const sup of si.supporting_departments) {
      await db.prepare(`
        INSERT INTO department_tasks
          (incident_id, department, role, task_description, problem_statement, action_required, expected_output)
        VALUES (?, ?, 'supporting', ?, ?, ?, ?)
      `).run(
        incidentId, sup.department,
        sup.action_required || sup.task || `Support ${si.category} resolution.`,
        sup.problem_statement || null,
        sup.action_required || sup.task || null,
        sup.expected_output || null,
      );
    }
  }

  if (raw_input_ids && raw_input_ids.length) {
    for (const id of raw_input_ids) {
      await db.prepare(`
        UPDATE raw_inputs
        SET processing_status='processed', incident_id=?, processed_at=?,
            ocr_confidence=?, detected_language=?, missing_fields=?
        WHERE id=?
      `).run(incidentId, now, ocr_confidence || null, detected_language || null, missing_fields || null, id);
    }
  }

  // Main audit trail — always runs first
  await db.prepare(`
    INSERT INTO audit_trail (incident_id, actor, action, new_value, notes)
    VALUES (?, 'UiPath', 'Incident created via automation pipeline', ?, ?)
  `).run(incidentId, initialStatus, JSON.stringify({
    confidence: si.llm_confidence || si.confidence,
    sentiment: si.sentiment_score,
    fallback: si.processed_via_fallback || false,
  }));

  // Duplicate audit — only runs if duplicate detected
  if (si.is_duplicate_likely) {
    await db.prepare(`
      INSERT INTO audit_trail (incident_id, actor, action, new_value, notes)
      VALUES (?, 'UiPath', 'Flagged as potential duplicate — status set to Pending', 'Pending', ?)
    `).run(incidentId, si.duplicate_reason || 'Similarity detected with existing incident');
  }

  res.json({ incident_id: incidentId, incident_ref: incidentRef });
});

router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { processing_status } = req.body;
  const valid = ['pending', 'processing', 'processed', 'failed'];
  if (!valid.includes(processing_status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  await db.prepare('UPDATE raw_inputs SET processing_status=? WHERE id=?').run(processing_status, id);
  res.json({ message: 'Updated' });
});

router.get('/queue', async (req, res) => {
  const { status } = req.query;
  const base = `
    SELECT id, filename, source_type, content_type, processing_status,
           uploaded_at, processed_at, error_message, incident_id, queue_item_id
    FROM raw_inputs
  `;
  const rows = status
    ? await db.prepare(base + ' WHERE processing_status = ? ORDER BY uploaded_at DESC').all(status)
    : await db.prepare(base + ' ORDER BY uploaded_at DESC').all();
  res.json(rows);
});

router.get('/:id/content', async (req, res) => {
  const record = await db.prepare('SELECT * FROM raw_inputs WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Not found' });
  try {
    let content;
    if (record.raw_text) {
      content = record.raw_text;
    } else if (record.content_type === 'text') {
      content = require('fs').readFileSync(record.file_path, 'utf8');
    } else if (record.content_type === 'pdf') {
      const pdfParse = require('pdf-parse/lib/pdf-parse.js');
      const buffer = require('fs').readFileSync(record.file_path);
      const data = await pdfParse(buffer);
      content = data.text;
    } else if (record.content_type === 'docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: record.file_path });
      content = result.value;
    } else {
      return res.json({ content: null, content_type: record.content_type, requires_image_analysis: true });
    }
    res.json({ content, content_type: record.content_type });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/file', async (req, res) => {
  const record = await db.prepare('SELECT * FROM raw_inputs WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Not found' });
  try {
    const fileBuffer = require('fs').readFileSync(record.file_path);
    const base64 = fileBuffer.toString('base64');
    res.json({ base64, filename: record.filename, content_type: record.content_type });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;