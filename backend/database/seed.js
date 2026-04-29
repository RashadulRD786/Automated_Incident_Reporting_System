require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('./db');
const bcrypt = require('bcryptjs');

const now = Math.floor(Date.now() / 1000);

function ts(secondsAgo) {
  return now - secondsAgo;
}

function hoursAgo(h) { return ts(h * 3600); }
function hoursFromNow(h) { return now + h * 3600; }

db.prepare('DELETE FROM audit_trail').run();
db.prepare('DELETE FROM department_tasks').run();
db.prepare('DELETE FROM raw_inputs').run();
db.prepare('DELETE FROM incidents').run();
db.prepare('DELETE FROM users').run();

const passwordHash = bcrypt.hashSync('Admin@1234', 10);
db.prepare(`INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)`).run(
  'admin@dhl.com', passwordHash, 'Admin User'
);
db.prepare(`INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)`).run(
  'agent@dhl.com', bcrypt.hashSync('Agent@1234', 10), 'Support Agent'
);

const insertIncident = db.prepare(`
  INSERT INTO incidents (incident_ref, title, summary, category, severity, status,
    primary_department, root_cause_suggestion, llm_confidence, is_duplicate,
    duplicate_reason, sla_hours, sla_deadline, is_overdue, created_at, updated_at,
    resolved_at, closed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertRaw = db.prepare(`
  INSERT INTO raw_inputs (filename, file_path, source_type, content_type, raw_text,
    ocr_confidence, processing_status, incident_id, uploaded_at, processed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertTask = db.prepare(`
  INSERT INTO department_tasks (incident_id, department, role, task_description, task_status, assigned_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertAudit = db.prepare(`
  INSERT INTO audit_trail (incident_id, actor, action, previous_value, new_value, notes, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// ─── Incident 1: COD Dispute | Critical | Finance | In Progress ───────────────
const i1 = insertIncident.run(
  'INC-2026-0001',
  'COD Payment Dispute – Customer Refuses to Pay',
  'Customer at delivery point refused to pay the COD amount of MYR 1,200 citing incorrect invoice total. Delivery agent reported the dispute via mobile app. Finance and Warehouse teams need to verify original COD slip and invoice. SLA breach imminent.',
  'COD Dispute', 'Critical', 'In Progress',
  'Finance',
  'Invoice total mismatch due to manual entry error at origin depot',
  0.92, 0, null,
  24, hoursFromNow(4), 0,
  hoursAgo(20), hoursAgo(2), null, null
);
insertRaw.run('COD_Invoice_001.pdf', '/uploads/COD_Invoice_001.pdf', 'manual', 'pdf',
  'COD Slip Reference: SHP-2026-88821\nAmount: MYR 1,200.00\nCustomer: Ahmad bin Razak\nDelivery Address: No 12, Jalan Setia, Petaling Jaya\nAgent: Khairul (ID: DHL-A-4421)',
  null, 'processed', i1.lastInsertRowid, hoursAgo(20), hoursAgo(19));
insertRaw.run(null, null, 'text_paste', 'text',
  'Customer called in to say the amount is wrong. Says original order was RM950 not RM1200. Very angry. Wants manager callback.',
  null, 'processed', i1.lastInsertRowid, hoursAgo(18), hoursAgo(17));
insertTask.run(i1.lastInsertRowid, 'Finance', 'primary', 'Verify COD invoice against original purchase order. Issue corrected invoice if discrepancy found. Approve or reject refund within SLA.', 'In Progress', hoursAgo(20), hoursAgo(2));
insertTask.run(i1.lastInsertRowid, 'Warehouse', 'supporting', 'Locate and scan original COD slip from origin depot. Confirm shipment weight and declared value match the invoice.', 'Completed', hoursAgo(19), hoursAgo(5));
insertTask.run(i1.lastInsertRowid, 'Customer Support', 'supporting', 'Contact customer to acknowledge dispute. Provide ETA for resolution. Arrange callback with Finance manager if required.', 'In Progress', hoursAgo(18), hoursAgo(1));
insertAudit.run(i1.lastInsertRowid, 'UiPath', 'Incident created by automation', null, 'New', 'Extracted from PDF and text fragment', hoursAgo(20));
insertAudit.run(i1.lastInsertRowid, 'System', 'Status updated', 'New', 'Assigned', null, hoursAgo(19));
insertAudit.run(i1.lastInsertRowid, 'Agent', 'Status updated', 'Assigned', 'In Progress', 'Warehouse team began investigation', hoursAgo(10));
insertAudit.run(i1.lastInsertRowid, 'System', 'SLA warning issued', null, null, 'Less than 25% SLA time remaining', hoursAgo(2));

// ─── Incident 2: Late Delivery | High | Customer Support | Assigned ───────────
const i2 = insertIncident.run(
  'INC-2026-0002',
  'Late Delivery – E-Commerce Parcel Delayed 5 Days',
  'Online shopper reports parcel not received despite tracking showing "Out for Delivery" for 5 consecutive days. Customer has escalated to e-commerce platform dispute team. Tracking number: MY-DHL-20263391.',
  'Late Delivery', 'High', 'Assigned',
  'Customer Support',
  'Route optimisation failure causing repeated delivery attempts without successful handover',
  0.85, 0, null,
  48, hoursFromNow(30), 0,
  hoursAgo(18), hoursAgo(15), null, null
);
insertRaw.run('delivery_complaint_2.pdf', '/uploads/delivery_complaint_2.pdf', 'uipath', 'pdf',
  'Complaint ID: EC-2026-55123\nTracking: MY-DHL-20263391\nShipper: Shopee Mall\nConsignee: Lim Wei Ling, Subang Jaya\nLast scan: Apr 24 – Out for Delivery\nCustomer note: "No one came to my door. I was home all day."',
  null, 'processed', i2.lastInsertRowid, hoursAgo(18), hoursAgo(17));
insertTask.run(i2.lastInsertRowid, 'Customer Support', 'primary', 'Contact consignee to confirm delivery address and availability. Arrange priority re-delivery within 24 hours. Update tracking system.', 'In Progress', hoursAgo(18), hoursAgo(3));
insertTask.run(i2.lastInsertRowid, 'Operations', 'supporting', 'Investigate delivery route and driver activity logs for April 24-29. Identify root cause of failed delivery attempts.', 'Not Started', hoursAgo(17), hoursAgo(17));
insertAudit.run(i2.lastInsertRowid, 'UiPath', 'Incident created by automation', null, 'New', 'PDF processed via UiPath automation', hoursAgo(18));
insertAudit.run(i2.lastInsertRowid, 'System', 'Status updated', 'New', 'Assigned', null, hoursAgo(15));
insertAudit.run(i2.lastInsertRowid, 'Agent', 'Task status updated', null, 'In Progress', 'Customer Support task started', hoursAgo(3));

// ─── Incident 3: System Error | Critical | IT | New ───────────────────────────
const i3 = insertIncident.run(
  'INC-2026-0003',
  'Shipment Tracking Portal – 500 Error on Bulk Query',
  'IT team alerted to recurring 500 Internal Server Error on the customer-facing tracking portal when querying more than 50 tracking numbers simultaneously. Affects enterprise clients using bulk API. Started approximately 3 hours ago.',
  'System Error', 'Critical', 'New',
  'IT',
  'Database connection pool exhaustion during high-concurrency bulk query requests',
  0.78, 0, null,
  4, hoursFromNow(1), 0,
  hoursAgo(3), hoursAgo(3), null, null
);
insertRaw.run(null, null, 'text_paste', 'text',
  'Error log excerpt:\n[2026-04-29 11:23:41] ERROR 500 /api/track/bulk\nSequelizeConnectionAcquireTimeoutError: Operation timeout\nPool size: 10/10 connections active\nQuery count: 847 in last 60s\nAffected clients: Lazada, Shopee Enterprise, Zalora',
  null, 'processed', i3.lastInsertRowid, hoursAgo(3), hoursAgo(3));
insertTask.run(i3.lastInsertRowid, 'IT', 'primary', 'Investigate connection pool exhaustion. Implement immediate fix – increase pool size or add query rate limiting. Monitor for 30 minutes post-fix.', 'Not Started', hoursAgo(3), hoursAgo(3));
insertAudit.run(i3.lastInsertRowid, 'UiPath', 'Incident created by automation', null, 'New', 'Text paste processed', hoursAgo(3));

// ─── Incident 4: Damaged Parcel | Medium | Warehouse | In Progress ────────────
const i4 = insertIncident.run(
  'INC-2026-0004',
  'Damaged Parcel – Electronics Item Reported Broken on Delivery',
  'Customer received a package containing a laptop. Outer carton shows significant compression damage. Customer reports the screen is cracked. Sender is a DHL Business Account holder. Insurance claim may be required.',
  'Damaged Parcel', 'Medium', 'In Progress',
  'Warehouse',
  'Inadequate fragile item handling during sortation at hub; insufficient cushioning noted',
  0.88, 0, null,
  24, hoursFromNow(10), 0,
  hoursAgo(14), hoursAgo(6), null, null
);
insertRaw.run('damaged_parcel_photo.jpg', '/uploads/damaged_parcel_photo.jpg', 'manual', 'image',
  'Damaged carton detected. Compression marks visible on all sides. "Fragile" sticker present but partially torn.',
  0.76, 'processed', i4.lastInsertRowid, hoursAgo(14), hoursAgo(13));
insertRaw.run('damage_report_form.pdf', '/uploads/damage_report_form.pdf', 'manual', 'pdf',
  'DHL Damage Report\nShipment: MY-DHL-20265544\nItem: Laptop – ASUS VivoBook 15\nDeclared Value: MYR 3,200\nCustomer: Priya Nair, Mont Kiara\nDescription: Screen cracked, hinge damaged',
  null, 'processed', i4.lastInsertRowid, hoursAgo(14), hoursAgo(13));
insertTask.run(i4.lastInsertRowid, 'Warehouse', 'primary', 'Retrieve parcel from returns bay. Document all damage with photos. Determine if damage occurred pre-transit or at sortation hub. Submit findings to insurance team.', 'In Progress', hoursAgo(14), hoursAgo(4));
insertTask.run(i4.lastInsertRowid, 'Customer Support', 'supporting', 'Acknowledge damage claim to customer. Initiate insurance claim process. Provide claim reference number within 24 hours.', 'Not Started', hoursAgo(13), hoursAgo(13));
insertAudit.run(i4.lastInsertRowid, 'UiPath', 'Incident created by automation', null, 'New', 'Image and PDF processed', hoursAgo(14));
insertAudit.run(i4.lastInsertRowid, 'System', 'Status updated', 'New', 'Assigned', null, hoursAgo(13));
insertAudit.run(i4.lastInsertRowid, 'Agent', 'Status updated', 'Assigned', 'In Progress', 'Warehouse investigation started', hoursAgo(6));

// ─── Incident 5: Wrong Address | Low | Operations | Pending ───────────────────
const i5 = insertIncident.run(
  'INC-2026-0005',
  'Parcel Delivered to Wrong Address – Neighbour Dispute',
  'Customer reports parcel was delivered to a neighbouring unit. Delivery proof of delivery signature belongs to an unknown person. Customer requests immediate retrieval and correct re-delivery.',
  'Wrong Address', 'Low', 'Pending',
  'Operations',
  'GPS pin error in driver navigation app led to incorrect unit selection in apartment block',
  0.81, 0, null,
  48, hoursFromNow(22), 0,
  hoursAgo(26), hoursAgo(4), null, null
);
insertRaw.run('wrong_delivery_complaint.pdf', '/uploads/wrong_delivery_complaint.pdf', 'uipath', 'pdf',
  'Shipment: MY-DHL-20261187\nConsignee: Tan Mei Ling, Unit 12-A, Sri Petaling\nPOD Signature: "Azman" – not recognised by customer\nCustomer note: Package contains medical supplies urgently needed.',
  null, 'processed', i5.lastInsertRowid, hoursAgo(26), hoursAgo(25));
insertTask.run(i5.lastInsertRowid, 'Operations', 'primary', 'Contact delivery driver to identify which unit received the parcel. Coordinate retrieval from incorrect recipient. Re-schedule delivery to correct address within 24 hours.', 'Completed', hoursAgo(26), hoursAgo(8));
insertTask.run(i5.lastInsertRowid, 'Customer Support', 'supporting', 'Inform customer of retrieval status. Provide updated delivery window. Offer compensation voucher per policy if delay exceeds 48 hours.', 'In Progress', hoursAgo(25), hoursAgo(4));
insertAudit.run(i5.lastInsertRowid, 'UiPath', 'Incident created by automation', null, 'New', null, hoursAgo(26));
insertAudit.run(i5.lastInsertRowid, 'System', 'Status updated', 'New', 'Assigned', null, hoursAgo(25));
insertAudit.run(i5.lastInsertRowid, 'Agent', 'Status updated', 'Assigned', 'In Progress', null, hoursAgo(20));
insertAudit.run(i5.lastInsertRowid, 'Agent', 'Status updated', 'In Progress', 'Pending', 'Awaiting confirmation from driver on parcel location', hoursAgo(4));

// ─── Incident 6: Late Delivery | High | Customer Support | Resolved ───────────
const resolvedAt6 = hoursAgo(2);
const i6 = insertIncident.run(
  'INC-2026-0006',
  'Late Delivery – B2B Shipment Missed Cut-off Window',
  'Corporate client reports critical B2B shipment of automotive parts arrived 18 hours after agreed contractual delivery window. Client has triggered SLA penalty clause. Finance team must process penalty and Operations must provide root cause report.',
  'Late Delivery', 'High', 'Resolved',
  'Customer Support',
  'Origin depot missed the 6PM cut-off due to staffing shortage; shipment held overnight',
  0.91, 0, null,
  48, hoursAgo(2), 0,
  hoursAgo(52), hoursAgo(4), resolvedAt6, null
);
insertRaw.run('b2b_sla_breach_report.pdf', '/uploads/b2b_sla_breach_report.pdf', 'uipath', 'pdf',
  'Client: AutoParts Sdn Bhd\nContract Ref: DHL-B2B-2026-3341\nAgreed Delivery: Apr 27 18:00\nActual Delivery: Apr 28 12:00\nDelay: 18 hours\nPenalty Clause: 2% of shipment value per hour of delay\nShipment Value: MYR 45,000',
  null, 'processed', i6.lastInsertRowid, hoursAgo(52), hoursAgo(51));
insertRaw.run('client_complaint_email.pdf', '/uploads/client_complaint_email.pdf', 'manual', 'pdf',
  'Email from procurement@autoparts.com.my – Subject: SLA Breach Notice\nFormal notice of SLA breach. Invoice for penalties to follow. Request written root cause report within 5 business days.',
  null, 'processed', i6.lastInsertRowid, hoursAgo(50), hoursAgo(49));
insertTask.run(i6.lastInsertRowid, 'Customer Support', 'primary', 'Acknowledge SLA breach formally. Coordinate penalty processing with Finance. Deliver written root cause analysis to client.', 'Completed', hoursAgo(52), hoursAgo(3));
insertAudit.run(i6.lastInsertRowid, 'UiPath', 'Incident created by automation', null, 'New', null, hoursAgo(52));
insertAudit.run(i6.lastInsertRowid, 'Agent', 'Status updated', 'New', 'Assigned', null, hoursAgo(50));
insertAudit.run(i6.lastInsertRowid, 'Agent', 'Status updated', 'Assigned', 'In Progress', null, hoursAgo(40));
insertAudit.run(i6.lastInsertRowid, 'Agent', 'Status updated', 'In Progress', 'Resolved', 'Root cause report submitted to client. Penalty processed.', hoursAgo(2));

// ─── Incident 7: COD Dispute | Medium | Finance | Closed ──────────────────────
const resolvedAt7 = hoursAgo(30);
const closedAt7 = hoursAgo(6);
const i7 = insertIncident.run(
  'INC-2026-0007',
  'COD Dispute – Duplicate Payment Collected',
  'Customer was charged COD twice for the same shipment due to a system glitch in the POS terminal. Customer has proof of double payment and requests full refund of duplicate charge.',
  'COD Dispute', 'Medium', 'Closed',
  'Finance',
  'POS terminal sync error caused double transaction record for single payment event',
  0.87, 0, null,
  24, hoursAgo(16), 0,
  hoursAgo(50), hoursAgo(8), resolvedAt7, closedAt7
);
insertRaw.run('double_payment_receipt.pdf', '/uploads/double_payment_receipt.pdf', 'manual', 'pdf',
  'Receipt 1: RM250.00 – 10:23AM\nReceipt 2: RM250.00 – 10:24AM\nSame terminal: T-0041\nSame shipment: MY-DHL-20265102\nCustomer: Zulaikha Hassan',
  null, 'processed', i7.lastInsertRowid, hoursAgo(50), hoursAgo(49));
insertTask.run(i7.lastInsertRowid, 'Finance', 'primary', 'Verify duplicate payment in POS system. Process full refund of MYR 250 to customer. Issue formal receipt for refund.', 'Completed', hoursAgo(50), hoursAgo(31));
insertAudit.run(i7.lastInsertRowid, 'UiPath', 'Incident created by automation', null, 'New', null, hoursAgo(50));
insertAudit.run(i7.lastInsertRowid, 'Agent', 'Status updated', 'New', 'Assigned', null, hoursAgo(48));
insertAudit.run(i7.lastInsertRowid, 'Agent', 'Status updated', 'Assigned', 'In Progress', 'Finance team verified double charge', hoursAgo(40));
insertAudit.run(i7.lastInsertRowid, 'Agent', 'Status updated', 'In Progress', 'Resolved', 'Refund of MYR 250 processed to customer bank account', hoursAgo(30));
insertAudit.run(i7.lastInsertRowid, 'Agent', 'Status updated', 'Resolved', 'Closed', 'Customer confirmed receipt of refund', hoursAgo(6));

// ─── Incident 8: Customer Complaint | Low | Customer Support | New (Duplicate) ─
const i8 = insertIncident.run(
  'INC-2026-0008',
  'Customer Complaint – Rude Delivery Agent',
  'Customer reports delivery agent was rude and dismissive when they asked for assistance bringing a heavy parcel to their unit. Customer demands formal apology and disciplinary action.',
  'Customer Complaint', 'Low', 'New',
  'Customer Support',
  'Staff conduct issue – insufficient soft-skills training for last-mile delivery personnel',
  0.73, 1, 'Similar complaint filed 3 days ago under INC-2026-0005 for the same delivery route and agent ID DHL-A-4421. Possible repeated misconduct.',
  72, hoursFromNow(68), 0,
  hoursAgo(4), hoursAgo(4), null, null
);
insertRaw.run(null, null, 'text_paste', 'text',
  'Customer email: "Your delivery man (the one who came to Bukit Jalil area) was extremely rude to me. I asked him nicely to help me carry the box and he just threw it at the door and left. I want a formal apology and to know what disciplinary action will be taken. This is not the first time this has happened."',
  null, 'processed', i8.lastInsertRowid, hoursAgo(4), hoursAgo(4));
insertTask.run(i8.lastInsertRowid, 'Customer Support', 'primary', 'Review complaint. Identify agent from route data. Escalate to HR if confirmed. Draft formal apology letter to customer.', 'Not Started', hoursAgo(4), hoursAgo(4));
insertAudit.run(i8.lastInsertRowid, 'UiPath', 'Incident created by automation', null, 'New', 'Duplicate flag raised – possible repeat complaint', hoursAgo(4));

console.log('✓ Database seeded successfully with 8 demo incidents.');
console.log('  Admin login: admin@dhl.com / Admin@1234');
console.log('  Agent login: agent@dhl.com / Agent@1234');
