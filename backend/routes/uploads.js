const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../database/db');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

// Severity-based SLA override (v2)
const getSLAHours = (severity, category) => {
  if (severity === 'Critical') return 6;
  if (severity === 'High')     return 24;
  const CATEGORY_SLA = {
    'System Error':        4,
    'COD Dispute':        24,
    'Damaged Parcel':     24,
    'Late Delivery':      48,
    'Missing Parcel':     48,
    'Wrong Address':      48,
    'Customer Complaint': 72,
    'Other':              72,
  };
  return CATEGORY_SLA[category] || 72;
};

// Add item to UiPath Orchestrator Queue
const addToUiPathQueue = async (raw_input_id, file_path, content_type, filename) => {
  try {
    const tokenRes = await fetch(
      //`${process.env.UIPATH_ORCHESTRATOR_URL}/identity_/connect/token`,
      `${process.env.UIPATH_ORCHESTRATOR_URL}/${process.env.UIPATH_ACCOUNT_NAME}/identity_/connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: process.env.UIPATH_CLIENT_ID,
          client_secret: process.env.UIPATH_CLIENT_SECRET,
          scope: 'OR.Queues',
        }),
      }
    );
    //const { access_token } = await tokenRes.json();
    const tokenData = await tokenRes.json();
    console.log('[UiPath Token Response]', JSON.stringify(tokenData));
    const { access_token } = tokenData;

    const queueRes = await fetch(
      //`${process.env.UIPATH_ORCHESTRATOR_URL}/odata/Queues/UiPathODataSvc.AddQueueItem`,
      //`${process.env.UIPATH_ORCHESTRATOR_URL}/${process.env.UIPATH_TENANT_NAME}/orchestrator_/odata/Queues/UiPathODataSvc.AddQueueItem`,
      `${process.env.UIPATH_ORCHESTRATOR_URL}/${process.env.UIPATH_ACCOUNT_NAME}/${process.env.UIPATH_TENANT_NAME}/orchestrator_/odata/Queues/UiPathODataSvc.AddQueueItem`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
          'X-UIPATH-TenantName': process.env.UIPATH_TENANT_NAME,
          'X-UIPATH-OrganizationUnitId': process.env.UIPATH_FOLDER_ID,
        },
        body: JSON.stringify({
          itemData: {
            Name: process.env.UIPATH_QUEUE_NAME,
            Priority: 'Normal',
            SpecificContent: { raw_input_id, file_path, content_type, filename },
          },
        }),
      }
    );
    //const data = await queueRes.json();
    //return data.Id || null;
    const queueText = await queueRes.text();
    console.log('[UiPath Queue Response Status]', queueRes.status);
    console.log('[UiPath Queue Response Body]', queueText);
    const data = JSON.parse(queueText);
    return data.Id || null;
  } catch (err) {
    console.warn('[UiPath Queue] Could not add queue item:', err.message);
    return null;
  }
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
  'image/jpeg',
  'image/jpg',
  'image/png',
  'text/plain',
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
  if (mime === 'text/plain') return 'text';
  return 'text';
}

router.post('/file', auth, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const { filename, mimetype } = req.file;
    const contentType = mimeToContentType(mimetype);
    //const filePath = `/uploads/${filename}`;
    const filePath = path.join(__dirname, '..', 'uploads', filename);

    const result = db.prepare(`
      INSERT INTO raw_inputs (filename, file_path, source_type, content_type, processing_status)
      VALUES (?, ?, 'manual', ?, 'pending')
    `).run(filename, filePath, contentType);

    const rawInputId = result.lastInsertRowid;

    //const queueItemId = await addToUiPathQueue(rawInputId, filePath, contentType, filename);
    //if (queueItemId) {
      //db.prepare('UPDATE raw_inputs SET queue_item_id = ? WHERE id = ?').run(String(queueItemId), rawInputId);
    //}

    res.json({ id: rawInputId, filename, status: 'pending' });
  });
});

router.post('/text', auth, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required' });

  const result = db.prepare(`
    INSERT INTO raw_inputs (source_type, content_type, raw_text, processing_status)
    VALUES ('text_paste', 'text', ?, 'pending')
  `).run(text.trim());

  const rawInputId = result.lastInsertRowid;

  //const queueItemId = await addToUiPathQueue(rawInputId, null, 'text', null);
  //if (queueItemId) {
    //db.prepare('UPDATE raw_inputs SET queue_item_id = ? WHERE id = ?').run(String(queueItemId), rawInputId);
  //}

  res.json({ id: rawInputId, status: 'pending' });
});

router.post('/uipath', (req, res) => {
  const {
    raw_input_ids,
    structured_incident,
    ocr_confidence,
    detected_language,
    missing_fields,
    error,
  } = req.body;

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

  const slaHours = getSLAHours(si.severity, si.category);
  const now = Math.floor(Date.now() / 1000);
  const slaDeadline = now + slaHours * 3600;

  const countRow = db.prepare("SELECT COUNT(*) as c FROM incidents").get();
  const seq = String(countRow.c + 1).padStart(4, '0');
  const incidentRef = `INC-${new Date().getFullYear()}-${seq}`;

  const incResult = db.prepare(`
    INSERT INTO incidents (
      incident_ref, title, summary, category, severity, status,
      primary_department,
      root_cause_suggestion, root_cause_hypothesis, root_cause_evidence, root_cause_confidence,
      llm_confidence, sentiment_score,
      is_duplicate, duplicate_reason, processed_via_fallback,
      sla_hours, sla_deadline, sla_state,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'New', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ON_TRACK', ?, ?)
  `).run(
    incidentRef, si.title, si.summary, si.category, si.severity,
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
    slaHours, slaDeadline,
    now, now
  );

  const incidentId = incResult.lastInsertRowid;

  // Primary department task
  const primaryPS = si.problem_statement || `Handle ${si.category} incident.`;
  const primaryAR = si.action_required || `Investigate and resolve as primary owner.`;
  const primaryEO = si.expected_output || `Resolution report and closure confirmation.`;
  db.prepare(`
    INSERT INTO department_tasks
      (incident_id, department, role, task_description, problem_statement, action_required, expected_output)
    VALUES (?, ?, 'primary', ?, ?, ?, ?)
  `).run(incidentId, si.primary_department, primaryAR, primaryPS, primaryAR, primaryEO);

  // Supporting department tasks
  if (si.supporting_departments && Array.isArray(si.supporting_departments)) {
    for (const sup of si.supporting_departments) {
      db.prepare(`
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

  // Update raw_inputs
  if (raw_input_ids && raw_input_ids.length) {
    const updateRaw = db.prepare(`
      UPDATE raw_inputs
      SET processing_status='processed', incident_id=?, processed_at=?,
          ocr_confidence=?, detected_language=?, missing_fields=?
      WHERE id=?
    `);
    for (const id of raw_input_ids) {
      updateRaw.run(incidentId, now, ocr_confidence || null, detected_language || null, missing_fields || null, id);
    }
  }

  db.prepare(`
    INSERT INTO audit_trail (incident_id, actor, action, new_value, notes)
    VALUES (?, 'UiPath', 'Incident created via automation pipeline', 'New', ?)
  `).run(incidentId, JSON.stringify({
    confidence: si.llm_confidence || si.confidence,
    sentiment: si.sentiment_score,
    fallback: si.processed_via_fallback || false,
  }));

  res.json({ incident_id: incidentId, incident_ref: incidentRef });
});

// PATCH /api/uploads/:id/status — used by UiPath to mark processing
router.patch('/:id/status', (req, res) => {
  const { id } = req.params;
  const { processing_status } = req.body;
  const valid = ['pending', 'processing', 'processed', 'failed'];
  if (!valid.includes(processing_status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  db.prepare('UPDATE raw_inputs SET processing_status=? WHERE id=?').run(processing_status, id);
  res.json({ message: 'Updated' });
});

router.get('/queue', (req, res) => {
  const { status } = req.query;
  const base = `
    SELECT id, filename, source_type, content_type, processing_status,
           uploaded_at, processed_at, error_message, incident_id, queue_item_id
    FROM raw_inputs
  `;
  const rows = status
    ? db.prepare(base + ' WHERE processing_status = ? ORDER BY uploaded_at DESC').all(status)
    : db.prepare(base + ' ORDER BY uploaded_at DESC').all();
  res.json(rows);
});

router.get('/:id/content', async (req, res) => {
  const record = db.prepare('SELECT * FROM raw_inputs WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Not found' });
  try {
    let content;
    if (record.raw_text) {
      content = record.raw_text;
    } else if (record.content_type === 'text') {
      const fs = require('fs');
      content = require('fs').readFileSync(record.file_path, 'utf8');
    } else if (record.content_type === 'pdf') {
      const pdfParse = require('pdf-parse');
      const fs = require('fs');
      const buffer = fs.readFileSync(record.file_path);
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

router.get('/:id/file', (req, res) => {
  const record = db.prepare('SELECT * FROM raw_inputs WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Not found' });
  try {
    const fs = require('fs');
    const fileBuffer = fs.readFileSync(record.file_path);
    const base64 = fileBuffer.toString('base64');
    res.json({ base64, filename: record.filename, content_type: record.content_type });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;


