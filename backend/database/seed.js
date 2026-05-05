require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('./db');
const bcrypt = require('bcryptjs');

const now = Math.floor(Date.now() / 1000);
function hoursAgo(h)    { return now - h * 3600; }
function hoursFromNow(h){ return now + h * 3600; }

function slaState(createdAt, slaHours, status) {
  if (['Resolved','Closed','Cancelled'].includes(status)) return 'COMPLETED';
  const total = slaHours * 3600;
  const elapsed = now - createdAt;
  const pct = (elapsed / total) * 100;
  if (pct >= 100) return 'BREACHED';
  if (pct >= 80)  return 'CRITICAL';
  if (pct >= 50)  return 'AT_RISK';
  return 'ON_TRACK';
}

db.prepare('DELETE FROM audit_trail').run();
db.prepare('DELETE FROM department_tasks').run();
db.prepare('DELETE FROM raw_inputs').run();
db.prepare('DELETE FROM incidents').run();
db.prepare('DELETE FROM users').run();
// Reset autoincrement counters
['audit_trail','department_tasks','raw_inputs','incidents','users'].forEach(t => {
  try { db.prepare(`DELETE FROM sqlite_sequence WHERE name='${t}'`).run(); } catch {}
});

const passwordHash = bcrypt.hashSync('Admin@1234', 10);
db.prepare(`INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)`).run('admin@dhl.com', passwordHash, 'Admin User');
db.prepare(`INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)`).run('agent@dhl.com', bcrypt.hashSync('Agent@1234', 10), 'Support Agent');

const insertIncident = db.prepare(`
  INSERT INTO incidents (
    incident_ref, title, summary, category, severity, status,
    primary_department,
    root_cause_suggestion, root_cause_hypothesis, root_cause_evidence, root_cause_confidence,
    llm_confidence, sentiment_score,
    is_duplicate, duplicate_reason, processed_via_fallback,
    sla_hours, sla_deadline, sla_state, is_overdue,
    first_response_at, created_at, updated_at, resolved_at, closed_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

const insertRaw = db.prepare(`
  INSERT INTO raw_inputs (filename, file_path, source_type, content_type, raw_text,
    ocr_confidence, detected_language, missing_fields, processing_status,
    incident_id, uploaded_at, processed_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
`);

const insertTask = db.prepare(`
  INSERT INTO department_tasks (incident_id, department, role,
    task_description, problem_statement, action_required, expected_output,
    task_status, assigned_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?)
`);

const insertAudit = db.prepare(`
  INSERT INTO audit_trail (incident_id, actor, action, previous_value, new_value, notes, created_at)
  VALUES (?,?,?,?,?,?,?)
`);

// ─── Incident 1: COD Dispute | Critical | Finance | In Progress | BREACHED ────
const c1 = hoursAgo(25); const sla1 = 6;
const i1 = insertIncident.run(
  'INC-2026-0001',
  'COD Payment Dispute – Customer Refuses to Pay',
  'Customer at delivery point refused to pay the COD amount of MYR 1,200 citing incorrect invoice total. Delivery agent reported the dispute via mobile app. Finance and Warehouse teams need to verify original COD slip and invoice.',
  'COD Dispute','Critical','In Progress','Finance',
  'Invoice total mismatch due to manual entry error at origin depot',
  'Invoice total mismatch due to manual entry error at origin depot',
  'COD slip (SHP-2026-88821) shows MYR 1,200 but original purchase order records MYR 950. Delta of MYR 250 likely from erroneous weight surcharge applied twice.',
  0.88, 0.92, 'Urgent',
  0, null, 0,
  sla1, hoursFromNow(-19), slaState(c1, sla1, 'In Progress'), 1,
  hoursAgo(24), c1, hoursAgo(2), null, null
);
insertRaw.run('COD_Invoice_001.pdf','/uploads/COD_Invoice_001.pdf','manual','pdf',
  'COD Slip Reference: SHP-2026-88821\nAmount: MYR 1,200.00\nCustomer: Ahmad bin Razak\nDelivery Address: No 12, Jalan Setia, Petaling Jaya\nAgent: Khairul (ID: DHL-A-4421)',
  null,'Malay',null,'processed',i1.lastInsertRowid,c1,hoursAgo(24));
insertRaw.run(null,null,'text_paste','text',
  'Customer called in to say the amount is wrong. Says original order was RM950 not RM1200. Very angry. Wants manager callback.',
  null,'English','tracking_number','processed',i1.lastInsertRowid,hoursAgo(23),hoursAgo(23));
insertTask.run(i1.lastInsertRowid,'Finance','primary',
  'Verify COD invoice against original PO.',
  'Invoice total of MYR 1,200 disputed by customer; original PO shows MYR 950.',
  'Cross-check COD slip SHP-2026-88821 against PO database. Issue corrected invoice if discrepancy confirmed. Approve or reject refund within SLA.',
  'Corrected invoice PDF + refund approval/rejection decision logged in system.',
  'In Progress',c1,hoursAgo(2));
insertTask.run(i1.lastInsertRowid,'Warehouse','supporting',
  'Locate original COD slip.',
  'Physical COD slip at origin depot may contain correct amount before system entry.',
  'Retrieve and scan original COD slip from depot SHP-2026-88821. Confirm shipment weight and declared value.',
  'Scanned COD slip image uploaded to incident record.',
  'Completed',c1,hoursAgo(5));
insertTask.run(i1.lastInsertRowid,'Customer Support','supporting',
  'Contact customer to acknowledge dispute.',
  'Customer is Urgent and expecting callback from Finance manager.',
  'Call customer Ahmad bin Razak. Acknowledge dispute. Provide ETA for resolution. Arrange Finance manager callback.',
  'Call log entry + customer acknowledged resolution timeline.',
  'In Progress',c1,hoursAgo(1));
insertAudit.run(i1.lastInsertRowid,'UiPath','Incident created via automation pipeline',null,'New','{"confidence":0.92,"sentiment":"Urgent","fallback":false}',c1);
insertAudit.run(i1.lastInsertRowid,'System','Status updated','New','Assigned',null,hoursAgo(24));
insertAudit.run(i1.lastInsertRowid,'Agent','Status updated','Assigned','In Progress','Warehouse team began investigation',hoursAgo(10));
insertAudit.run(i1.lastInsertRowid,'System','SLA BREACHED',null,null,'Incident exceeded 6h SLA for Critical severity',hoursAgo(1));

// ─── Incident 2: Late Delivery | High | Customer Support | Assigned | AT_RISK ─
const c2 = hoursAgo(16); const sla2 = 24;
const i2 = insertIncident.run(
  'INC-2026-0002',
  'Late Delivery – E-Commerce Parcel Delayed 5 Days',
  'Online shopper reports parcel not received despite tracking showing "Out for Delivery" for 5 consecutive days. Customer has escalated to e-commerce platform dispute team. Tracking number: MY-DHL-20263391.',
  'Late Delivery','High','Assigned','Customer Support',
  'Route optimisation failure causing repeated failed delivery attempts',
  'Route optimisation failure causing repeated failed delivery attempts',
  'Driver activity log shows 5 failed delivery scans at wrong GPS coordinates. Navigation app reported incorrect pin for apartment block.',
  0.82, 0.85, 'Negative',
  0, null, 0,
  sla2, hoursFromNow(8), slaState(c2, sla2, 'Assigned'), 0,
  hoursAgo(15), c2, hoursAgo(13), null, null
);
insertRaw.run('delivery_complaint_2.pdf','/uploads/delivery_complaint_2.pdf','uipath','pdf',
  'Complaint ID: EC-2026-55123\nTracking: MY-DHL-20263391\nShipper: Shopee Mall\nConsignee: Lim Wei Ling, Subang Jaya\nLast scan: Apr 24 – Out for Delivery\nCustomer note: "No one came to my door. I was home all day."',
  null,'English',null,'processed',i2.lastInsertRowid,c2,hoursAgo(15));
insertTask.run(i2.lastInsertRowid,'Customer Support','primary',
  'Arrange priority re-delivery.',
  'Consignee has not received parcel after 5 delivery attempts due to GPS pin error.',
  'Contact consignee Lim Wei Ling to confirm address and availability. Arrange priority re-delivery within 24 hours. Update tracking system with correct GPS coordinates.',
  'Confirmed re-delivery booking with new tracking scan at correct address.',
  'In Progress',c2,hoursAgo(3));
insertTask.run(i2.lastInsertRowid,'Operations','supporting',
  'Investigate route failure.',
  'Driver navigation app routed to incorrect unit 5 times without supervisor escalation.',
  'Review delivery route logs and driver activity for April 24-29. Identify GPS pin error source. Submit correction request to routing team.',
  'Root cause report with GPS correction ticket reference number.',
  'Not Started',c2,c2);
insertAudit.run(i2.lastInsertRowid,'UiPath','Incident created via automation pipeline',null,'New','{"confidence":0.85,"sentiment":"Negative","fallback":false}',c2);
insertAudit.run(i2.lastInsertRowid,'System','Status updated','New','Assigned',null,hoursAgo(15));
insertAudit.run(i2.lastInsertRowid,'Agent','Task status updated',null,'In Progress','Customer Support task started',hoursAgo(3));

// ─── Incident 3: System Error | Critical | IT | New | CRITICAL ───────────────
const c3 = hoursAgo(5); const sla3 = 6;
const i3 = insertIncident.run(
  'INC-2026-0003',
  'Shipment Tracking Portal – 500 Error on Bulk Query',
  'IT team alerted to recurring 500 Internal Server Error on the customer-facing tracking portal when querying more than 50 tracking numbers simultaneously. Affects enterprise clients using bulk API.',
  'System Error','Critical','New','IT',
  'Database connection pool exhaustion during high-concurrency bulk query requests',
  'Database connection pool exhaustion during high-concurrency bulk query requests',
  'Error logs show pool at 10/10 active connections with 847 queries in 60 seconds. Three enterprise clients (Lazada, Shopee, Zalora) affected simultaneously.',
  0.78, 0.78, 'Urgent',
  0, null, 0,
  sla3, hoursFromNow(1), slaState(c3, sla3, 'New'), 0,
  null, c3, c3, null, null
);
insertRaw.run(null,null,'text_paste','text',
  '[2026-04-29 11:23:41] ERROR 500 /api/track/bulk\nSequelizeConnectionAcquireTimeoutError: Operation timeout\nPool size: 10/10 connections active\nQuery count: 847 in last 60s\nAffected clients: Lazada, Shopee Enterprise, Zalora',
  null,'English','customer_id, tracking_number','processed',i3.lastInsertRowid,c3,c3);
insertTask.run(i3.lastInsertRowid,'IT','primary',
  'Fix connection pool exhaustion.',
  'Tracking portal bulk query endpoint causing DB connection pool exhaustion under enterprise load.',
  'Increase connection pool size to 50. Implement rate limiting of 20 req/s per client on /api/track/bulk. Deploy hotfix to staging then production. Monitor for 30 minutes post-deploy.',
  'Hotfix deployed, pool size confirmed at 50, zero 500 errors for 30 consecutive minutes.',
  'Not Started',c3,c3);
insertAudit.run(i3.lastInsertRowid,'UiPath','Incident created via automation pipeline',null,'New','{"confidence":0.78,"sentiment":"Urgent","fallback":false}',c3);

// ─── Incident 4: Damaged Parcel | Medium | Warehouse | In Progress | ON_TRACK ─
const c4 = hoursAgo(6); const sla4 = 24;
const i4 = insertIncident.run(
  'INC-2026-0004',
  'Damaged Parcel – Electronics Item Reported Broken on Delivery',
  'Customer received a package containing a laptop. Outer carton shows significant compression damage. Customer reports the screen is cracked. Sender is a DHL Business Account holder. Insurance claim may be required.',
  'Damaged Parcel','Medium','In Progress','Warehouse',
  'Inadequate fragile item handling during sortation; insufficient cushioning',
  'Inadequate fragile item handling during sortation at hub; insufficient cushioning noted in inspection photos.',
  'Damage pattern (all-side compression marks, torn fragile sticker) consistent with sortation belt pressure. Similar damages reported at KL Hub in past 30 days.',
  0.84, 0.88, 'Negative',
  0, null, 0,
  sla4, hoursFromNow(18), slaState(c4, sla4, 'In Progress'), 0,
  hoursAgo(5), c4, hoursAgo(2), null, null
);
insertRaw.run('damaged_parcel_photo.jpg','/uploads/damaged_parcel_photo.jpg','manual','image',
  'Damaged carton detected. Compression marks visible on all sides. "Fragile" sticker present but partially torn. Laptop box deformed.',
  0.45,'English',null,'processed',i4.lastInsertRowid,c4,hoursAgo(5));
insertRaw.run('damage_report_form.pdf','/uploads/damage_report_form.pdf','manual','pdf',
  'DHL Damage Report\nShipment: MY-DHL-20265544\nItem: Laptop – ASUS VivoBook 15\nDeclared Value: MYR 3,200\nCustomer: Priya Nair, Mont Kiara',
  null,'English',null,'processed',i4.lastInsertRowid,c4,hoursAgo(5));
insertTask.run(i4.lastInsertRowid,'Warehouse','primary',
  'Document and investigate damage.',
  'Physical damage to laptop shipment suggests sortation mishandling at KL Hub.',
  'Retrieve parcel from returns bay. Photograph all damage angles. Compare with hub CCTV for timeline. Determine if damage is pre-transit or sortation-related.',
  'Damage investigation report with photo evidence and CCTV reference uploaded.',
  'In Progress',c4,hoursAgo(2));
insertTask.run(i4.lastInsertRowid,'Customer Support','supporting',
  'Initiate insurance claim.',
  'Customer Priya Nair expects claim reference within 24 hours per DHL policy.',
  'Acknowledge damage to customer. Initiate insurance claim for MYR 3,200. Provide claim reference number.',
  'Insurance claim reference number issued and communicated to customer.',
  'Not Started',c4,c4);
insertAudit.run(i4.lastInsertRowid,'UiPath','Incident created via automation pipeline',null,'New','{"confidence":0.88,"sentiment":"Negative","fallback":false}',c4);
insertAudit.run(i4.lastInsertRowid,'System','Status updated','New','Assigned',null,hoursAgo(5));
insertAudit.run(i4.lastInsertRowid,'Agent','Status updated','Assigned','In Progress','Warehouse investigation started',hoursAgo(2));

// ─── Incident 5: Wrong Address | Low | Operations | Pending | ON_TRACK ────────
const c5 = hoursAgo(10); const sla5 = 48;
const i5 = insertIncident.run(
  'INC-2026-0005',
  'Parcel Delivered to Wrong Address – Neighbour Dispute',
  'Customer reports parcel was delivered to a neighbouring unit. Delivery proof of delivery signature belongs to an unknown person. Customer requests immediate retrieval and correct re-delivery.',
  'Wrong Address','Low','Pending','Operations',
  'GPS pin error in driver navigation app',
  'GPS pin error in driver navigation app led to incorrect unit selection in apartment block.',
  'POD signature "Azman" not matching customer record. Driver log shows correct unit entered but GPS routed to adjacent block entrance.',
  0.79, 0.81, 'Neutral',
  0, null, 0,
  sla5, hoursFromNow(38), slaState(c5, sla5, 'Pending'), 0,
  hoursAgo(9), c5, hoursAgo(2), null, null
);
insertRaw.run('wrong_delivery_complaint.pdf','/uploads/wrong_delivery_complaint.pdf','uipath','pdf',
  'Shipment: MY-DHL-20261187\nConsignee: Tan Mei Ling, Unit 12-A, Sri Petaling\nPOD Signature: "Azman" – not recognised by customer\nCustomer note: Package contains medical supplies urgently needed.',
  null,'English',null,'processed',i5.lastInsertRowid,c5,hoursAgo(9));
insertTask.run(i5.lastInsertRowid,'Operations','primary',
  'Retrieve and re-deliver parcel.',
  'Parcel delivered to wrong unit in Sri Petaling apartment block.',
  'Contact driver to identify which unit received parcel. Coordinate retrieval from incorrect recipient. Re-schedule delivery to Unit 12-A within 24 hours.',
  'Parcel retrieved and redelivered to correct address with new POD.',
  'Completed',c5,hoursAgo(6));
insertTask.run(i5.lastInsertRowid,'Customer Support','supporting',
  'Inform customer and offer compensation.',
  'Customer has time-sensitive medical supplies in parcel. High risk of escalation.',
  'Inform Tan Mei Ling of retrieval status. Provide updated delivery window. Offer MYR 20 voucher per delay policy.',
  'Customer informed via call. Voucher code issued if delay exceeds 48h.',
  'In Progress',c5,hoursAgo(2));
insertAudit.run(i5.lastInsertRowid,'UiPath','Incident created via automation pipeline',null,'New',null,c5);
insertAudit.run(i5.lastInsertRowid,'System','Status updated','New','Assigned',null,hoursAgo(9));
insertAudit.run(i5.lastInsertRowid,'Agent','Status updated','Assigned','In Progress',null,hoursAgo(8));
insertAudit.run(i5.lastInsertRowid,'Agent','Status updated','In Progress','Pending','Awaiting driver confirmation on parcel location',hoursAgo(2));

// ─── Incident 6: Late Delivery | High | Customer Support | Resolved | COMPLETED
const c6 = hoursAgo(52); const sla6 = 24; const res6 = hoursAgo(2);
const i6 = insertIncident.run(
  'INC-2026-0006',
  'Late Delivery – B2B Shipment Missed Cut-off Window',
  'Corporate client reports critical B2B shipment of automotive parts arrived 18 hours after agreed contractual delivery window. Client has triggered SLA penalty clause.',
  'Late Delivery','High','Resolved','Customer Support',
  'Origin depot missed 6PM cut-off due to staffing shortage',
  'Origin depot missed the 6PM cut-off due to staffing shortage; shipment held overnight.',
  'Depot staffing log shows 40% under-capacity on Apr 27. Cut-off queue had 23 pending shipments at 18:00. No supervisor override requested.',
  0.91, 0.91, 'Negative',
  0, null, 0,
  sla6, hoursAgo(28), 'COMPLETED', 0,
  hoursAgo(50), c6, hoursAgo(4), res6, null
);
insertRaw.run('b2b_sla_breach_report.pdf','/uploads/b2b_sla_breach_report.pdf','uipath','pdf',
  'Client: AutoParts Sdn Bhd\nContract Ref: DHL-B2B-2026-3341\nAgreed Delivery: Apr 27 18:00\nActual Delivery: Apr 28 12:00\nDelay: 18 hours',
  null,'English',null,'processed',i6.lastInsertRowid,c6,hoursAgo(51));
insertRaw.run('client_complaint_email.pdf','/uploads/client_complaint_email.pdf','manual','pdf',
  'Email from procurement@autoparts.com.my – Subject: SLA Breach Notice\nFormal notice of SLA breach. Penalty invoice to follow. Request root cause report within 5 business days.',
  null,'English',null,'processed',i6.lastInsertRowid,hoursAgo(50),hoursAgo(49));
insertTask.run(i6.lastInsertRowid,'Customer Support','primary','Handle B2B SLA breach.',
  'B2B client AutoParts Sdn Bhd invoking SLA penalty clause for 18-hour late delivery.',
  'Acknowledge SLA breach formally in writing. Coordinate penalty processing with Finance. Deliver root cause analysis to client.',
  'Formal acknowledgement letter + penalty credit note + root cause report delivered.',
  'Completed',c6,hoursAgo(3));
insertAudit.run(i6.lastInsertRowid,'UiPath','Incident created via automation pipeline',null,'New',null,c6);
insertAudit.run(i6.lastInsertRowid,'Agent','Status updated','New','Assigned',null,hoursAgo(50));
insertAudit.run(i6.lastInsertRowid,'Agent','Status updated','Assigned','In Progress',null,hoursAgo(40));
insertAudit.run(i6.lastInsertRowid,'Agent','Status updated','In Progress','Resolved','Root cause report submitted. Penalty processed.',res6);

// ─── Incident 7: COD Dispute | Medium | Finance | Closed | COMPLETED ──────────
const c7 = hoursAgo(50); const sla7 = 24; const res7 = hoursAgo(30); const cls7 = hoursAgo(6);
const i7 = insertIncident.run(
  'INC-2026-0007',
  'COD Dispute – Duplicate Payment Collected',
  'Customer was charged COD twice for the same shipment due to a POS terminal sync error. Customer has proof of double payment and requests full refund.',
  'COD Dispute','Medium','Closed','Finance',
  'POS terminal sync error caused double transaction record',
  'POS terminal sync error caused double transaction record for single payment event.',
  'Terminal T-0041 logs show two charge records at 10:23AM and 10:24AM for same shipment MY-DHL-20265102. Sync delay of 61 seconds between terminal and backend.',
  0.93, 0.87, 'Negative',
  0, null, 0,
  sla7, hoursAgo(26), 'COMPLETED', 0,
  hoursAgo(49), c7, hoursAgo(8), res7, cls7
);
insertRaw.run('double_payment_receipt.pdf','/uploads/double_payment_receipt.pdf','manual','pdf',
  'Receipt 1: RM250.00 – 10:23AM\nReceipt 2: RM250.00 – 10:24AM\nSame terminal: T-0041\nSame shipment: MY-DHL-20265102\nCustomer: Zulaikha Hassan',
  null,'English',null,'processed',i7.lastInsertRowid,c7,hoursAgo(49));
insertTask.run(i7.lastInsertRowid,'Finance','primary','Verify and refund duplicate charge.',
  'POS terminal T-0041 recorded two charges of MYR 250 for single COD transaction.',
  'Verify duplicate in POS backend logs. Process MYR 250 refund to customer bank account. Submit terminal sync bug report to IT.',
  'Refund receipt issued + IT bug ticket reference number logged.',
  'Completed',c7,hoursAgo(31));
insertAudit.run(i7.lastInsertRowid,'UiPath','Incident created via automation pipeline',null,'New',null,c7);
insertAudit.run(i7.lastInsertRowid,'Agent','Status updated','New','Assigned',null,hoursAgo(48));
insertAudit.run(i7.lastInsertRowid,'Agent','Status updated','Assigned','In Progress','Finance verified double charge',hoursAgo(40));
insertAudit.run(i7.lastInsertRowid,'Agent','Status updated','In Progress','Resolved','Refund of MYR 250 processed',res7);
insertAudit.run(i7.lastInsertRowid,'Agent','Status updated','Resolved','Closed','Customer confirmed receipt of refund',cls7);

// ─── Incident 8: Customer Complaint | Low | CS | New | Duplicate ─────────────
const c8 = hoursAgo(2); const sla8 = 72;
const i8 = insertIncident.run(
  'INC-2026-0008',
  'Customer Complaint – Rude Delivery Agent',
  'Customer reports delivery agent was rude and dismissive when asked for assistance bringing a heavy parcel to their unit. Customer demands formal apology and disciplinary action.',
  'Customer Complaint','Low','New','Customer Support',
  'Staff conduct issue – insufficient soft-skills training',
  'Repeated conduct complaint for agent ID DHL-A-4421 on Bukit Jalil route.',
  'Similar complaint filed 3 days ago under INC-2026-0005 for same delivery route and agent. Pattern suggests systemic conduct issue rather than isolated incident.',
  0.73, 0.73, 'Negative',
  1, 'Similar complaint filed 3 days ago under INC-2026-0005 for same delivery route and agent ID DHL-A-4421. Possible repeated misconduct.', 0,
  sla8, hoursFromNow(70), slaState(c8, sla8, 'New'), 0,
  null, c8, c8, null, null
);
insertRaw.run(null,null,'text_paste','text',
  'Customer email: "Your delivery man (the one who came to Bukit Jalil area) was extremely rude to me. I asked him nicely to help me carry the box and he just threw it at the door and left. I want a formal apology and to know what disciplinary action will be taken."',
  null,'English',null,'processed',i8.lastInsertRowid,c8,c8);
insertTask.run(i8.lastInsertRowid,'Customer Support','primary','Handle conduct complaint.',
  'Customer complaint about rude behaviour from agent DHL-A-4421 on Bukit Jalil route — second complaint in 3 days.',
  'Review complaint. Identify agent from route data. Escalate to HR if confirmed. Draft formal apology letter to customer within 24 hours.',
  'Formal apology letter sent + HR escalation reference number if misconduct confirmed.',
  'Not Started',c8,c8);
insertAudit.run(i8.lastInsertRowid,'UiPath','Incident created via automation pipeline',null,'New','Duplicate flag raised – possible repeat complaint',c8);

console.log('✓ Database seeded with 8 v2 demo incidents.');
console.log('  Admin: admin@dhl.com / Admin@1234');
console.log('  Agent: agent@dhl.com / Agent@1234');
console.log('  SLA states: INC-0001=BREACHED, INC-0002=AT_RISK, INC-0003=CRITICAL, INC-0004=ON_TRACK');
