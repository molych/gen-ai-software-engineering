'use strict';

/**
 * Deterministic fixture generator for the test suite.
 * Produces valid CSV/JSON/XML sample files plus invalid files for negative
 * tests, all under tests/fixtures/. Re-run with: node scripts/generate-fixtures.js
 */

const fs = require('fs');
const path = require('path');

const FIXTURES_DIR = path.join(__dirname, '..', 'tests', 'fixtures');

// --- Deterministic PRNG (LCG) so fixtures are stable across runs -------------
let seed = 20260521;
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

// --- Content pools -----------------------------------------------------------
const TEMPLATES = {
  account_access: [
    [
      'Cannot login to my account',
      'I cannot log in to my account even after a password reset.',
    ],
    [
      'Password reset link not working',
      'The password reset email link expired before I could use it.',
    ],
    ['2FA codes never arrive', 'My two-factor authentication codes never arrive by SMS.'],
    [
      'Locked out after failed sign in',
      'I am locked out of my account after several sign-in attempts.',
    ],
  ],
  technical_issue: [
    [
      'Application crashes on startup',
      'The application crashes every time I open it on desktop.',
    ],
    [
      'Dashboard page not working',
      'The dashboard page is not working and shows an error.',
    ],
    [
      'Export feature throws an error',
      'I get an error and the app freezes when I export data.',
    ],
    ['Sync is extremely slow', 'Data sync is extremely slow and sometimes times out.'],
  ],
  billing_question: [
    [
      'Refund request for duplicate charge',
      'Please process a refund for a duplicate payment on my invoice.',
    ],
    ['Invoice amount looks wrong', 'My latest invoice has a charge I do not recognise.'],
    ['Payment keeps failing', 'My credit card payment keeps failing at checkout.'],
    [
      'Question about subscription pricing',
      'I have a billing question about subscription pricing tiers.',
    ],
  ],
  feature_request: [
    [
      'Please add a dark mode',
      'It would be nice if you could please add a dark mode feature.',
    ],
    [
      'Feature request: PDF export',
      'Feature request: an enhancement to export reports as PDF.',
    ],
    [
      'Suggestion for better filters',
      'I wish the filters had more options; it would help a lot.',
    ],
    [
      'Improvement idea for notifications',
      'An improvement to notification settings would be welcome.',
    ],
  ],
  bug_report: [
    [
      'Bug with steps to reproduce',
      'Bug: steps to reproduce a crash when opening reports.',
    ],
    [
      'Defect in search results',
      'There is a defect causing a regression in search results.',
    ],
    [
      'Glitch when saving profile',
      'A glitch causes unexpected behavior when saving a profile.',
    ],
    [
      'Reproduction for layout bug',
      'Reproduction steps for a layout bug on the settings page.',
    ],
  ],
  other: [
    [
      'General question about service',
      'I have a general question about how your service works.',
    ],
    ['Thanks for the great support', 'Just wanted to say thank you to the support team.'],
    [
      'Inquiry about availability',
      'An inquiry about regional availability of your product.',
    ],
    [
      'Update to my contact details',
      'I would like to update the contact details on file.',
    ],
  ],
};

const PRIORITY_HINT = {
  urgent: ' This is critical and production is down.',
  high: ' This is important and blocking my work, please treat it asap.',
  low: ' This is only a minor cosmetic issue.',
  medium: '',
};

const FIRST_NAMES = [
  'Ann',
  'Bram',
  'Chloe',
  'Diego',
  'Elena',
  'Femi',
  'Grace',
  'Hiro',
  'Ivan',
  'Jana',
];
const LAST_NAMES = [
  'Adler',
  'Bishop',
  'Costa',
  'Dubois',
  'Engel',
  'Farah',
  'Greco',
  'Haas',
  'Iyer',
  'Jung',
];
const STATUSES = ['new', 'in_progress', 'waiting_customer', 'resolved', 'closed'];
const SOURCES = ['web_form', 'email', 'api', 'chat', 'phone'];
const DEVICES = ['desktop', 'mobile', 'tablet'];
const BROWSERS = ['Chrome 124', 'Firefox 126', 'Safari 17', 'Edge 124'];
const TAG_POOL = [
  'vip',
  'follow-up',
  'escalated',
  'first-contact',
  'mobile',
  'enterprise',
];
const PRIORITIES = ['urgent', 'high', 'medium', 'low'];

/** Build one valid ticket record. */
function makeTicket(i) {
  const category = pick(Object.keys(TEMPLATES));
  const [subject, baseDesc] = pick(TEMPLATES[category]);
  const priority = pick(PRIORITIES);
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const tags = [];
  if (rand() > 0.5) tags.push(pick(TAG_POOL));
  if (rand() > 0.7) tags.push(pick(TAG_POOL));

  return {
    customer_id: `CUST-${1000 + i}`,
    customer_email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    customer_name: `${first} ${last}`,
    subject,
    description: baseDesc + PRIORITY_HINT[priority],
    category,
    priority,
    status: pick(STATUSES),
    assigned_to: rand() > 0.5 ? `agent-${1 + Math.floor(rand() * 8)}` : '',
    tags: [...new Set(tags)],
    metadata: {
      source: pick(SOURCES),
      browser: pick(BROWSERS),
      device_type: pick(DEVICES),
    },
  };
}

// --- Serializers -------------------------------------------------------------
function csvEscape(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function toCsv(tickets) {
  const cols = [
    'customer_id',
    'customer_email',
    'customer_name',
    'subject',
    'description',
    'category',
    'priority',
    'status',
    'assigned_to',
    'tags',
    'metadata_source',
    'metadata_browser',
    'metadata_device_type',
  ];
  const lines = [cols.join(',')];
  for (const t of tickets) {
    lines.push(
      [
        t.customer_id,
        t.customer_email,
        t.customer_name,
        t.subject,
        t.description,
        t.category,
        t.priority,
        t.status,
        t.assigned_to,
        t.tags.join(';'),
        t.metadata.source,
        t.metadata.browser,
        t.metadata.device_type,
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  return lines.join('\n') + '\n';
}

function toJson(tickets) {
  return JSON.stringify(tickets, null, 2) + '\n';
}

function xmlEscape(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toXml(tickets) {
  const parts = ['<?xml version="1.0" encoding="UTF-8"?>', '<tickets>'];
  for (const t of tickets) {
    parts.push('  <ticket>');
    for (const key of [
      'customer_id',
      'customer_email',
      'customer_name',
      'subject',
      'description',
      'category',
      'priority',
      'status',
      'assigned_to',
    ]) {
      parts.push(`    <${key}>${xmlEscape(t[key])}</${key}>`);
    }
    parts.push(
      '    <tags>' + t.tags.map((x) => `<tag>${xmlEscape(x)}</tag>`).join('') + '</tags>',
    );
    parts.push('    <metadata>');
    parts.push(`      <source>${xmlEscape(t.metadata.source)}</source>`);
    parts.push(`      <browser>${xmlEscape(t.metadata.browser)}</browser>`);
    parts.push(`      <device_type>${xmlEscape(t.metadata.device_type)}</device_type>`);
    parts.push('    </metadata>');
    parts.push('  </ticket>');
  }
  parts.push('</tickets>');
  return parts.join('\n') + '\n';
}

// --- Write everything --------------------------------------------------------
function write(name, content) {
  fs.writeFileSync(path.join(FIXTURES_DIR, name), content);
  console.log(`wrote ${name}`);
}

function main() {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  const csvTickets = Array.from({ length: 50 }, (_, i) => makeTicket(i));
  const jsonTickets = Array.from({ length: 20 }, (_, i) => makeTicket(i + 50));
  const xmlTickets = Array.from({ length: 30 }, (_, i) => makeTicket(i + 70));

  write('sample_tickets.csv', toCsv(csvTickets));
  write('sample_tickets.json', toJson(jsonTickets));
  write('sample_tickets.xml', toXml(xmlTickets));

  // Invalid: valid CSV structure, rows that fail validation.
  write(
    'invalid_missing_fields.csv',
    'customer_id,customer_email,customer_name,subject,description\n' +
      '"CUST-1","not-an-email","No Subject Person","","short"\n' +
      '"","missing@example.com","","A subject","This description is long enough to pass."\n',
  );

  // Invalid: valid JSON, records that fail validation (bad email, short fields).
  write(
    'invalid_bad_email.json',
    JSON.stringify(
      [
        {
          customer_id: 'CUST-X1',
          customer_email: 'bademail',
          customer_name: 'Bad Email',
          subject: 'Login issue',
          description: 'I cannot log in to my account at all today.',
        },
        {
          customer_id: 'CUST-X2',
          customer_email: 'ok@example.com',
          customer_name: 'Short Desc',
          subject: 'Hi',
          description: 'too short',
        },
      ],
      null,
      2,
    ) + '\n',
  );

  // Invalid: valid XML, unknown enum value.
  write(
    'invalid_enum.xml',
    '<?xml version="1.0" encoding="UTF-8"?>\n<tickets>\n  <ticket>\n' +
      '    <customer_id>CUST-X3</customer_id>\n' +
      '    <customer_email>enum@example.com</customer_email>\n' +
      '    <customer_name>Enum Tester</customer_name>\n' +
      '    <subject>Strange category</subject>\n' +
      '    <description>This ticket uses a category value that does not exist.</description>\n' +
      '    <category>not_a_real_category</category>\n' +
      '  </ticket>\n</tickets>\n',
  );

  // Malformed: unparseable content for parse-failure tests.
  write('malformed.json', '{ "tickets": [ { "customer_id": "CUST-X4", ');
  write(
    'malformed.xml',
    '<?xml version="1.0"?>\n<tickets>\n  <ticket><subject>Unclosed tag\n</tickets>\n',
  );

  console.log('\nFixtures generated in tests/fixtures/');
}

main();
