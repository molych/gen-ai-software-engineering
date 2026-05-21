# Intelligent Customer Support System — API Reference

This document describes the REST API for the Intelligent Customer Support System. All endpoints use JSON for requests and responses.

**Base URL:** `http://localhost:3000`

---

## Health Check

### GET /health

Liveness probe endpoint. Returns the service status.

**Request:**
```bash
curl -X GET http://localhost:3000/health
```

**Response:** 200 OK
```json
{
  "status": "ok",
  "service": "customer-support-system"
}
```

---

## Tickets API

### Create a Single Ticket

#### POST /tickets

Create a new support ticket. Optionally apply automatic classification using AI.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `autoClassify` | boolean | If `true`, automatically classify the ticket (optional) |
| `auto_classify` | boolean | Alternative spelling for `autoClassify` (optional) |

**Request Body:**
```json
{
  "customer_id": "string (required)",
  "customer_email": "string (required, valid email)",
  "customer_name": "string (required)",
  "subject": "string (required, 1–200 characters)",
  "description": "string (required, 10–2000 characters)",
  "category": "string (optional, one of: account_access, technical_issue, billing_question, feature_request, bug_report, other)",
  "priority": "string (optional, one of: urgent, high, medium, low)",
  "status": "string (optional, one of: new, in_progress, waiting_customer, resolved, closed)",
  "assigned_to": "string (optional, nullable)",
  "tags": ["string"] (optional, array of strings),
  "metadata": {
    "source": "string (optional, one of: web_form, email, api, chat, phone; default: api)",
    "browser": "string (optional, nullable)",
    "device_type": "string (optional, one of: desktop, mobile, tablet; default: desktop)"
  }
}
```

**Response:** 201 Created
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "customer_id": "cust_123",
  "customer_email": "user@example.com",
  "customer_name": "John Doe",
  "subject": "Cannot log in to account",
  "description": "I've been locked out of my account after 3 failed attempts.",
  "category": "account_access",
  "priority": "high",
  "status": "new",
  "created_at": "2026-05-21T10:30:00.000Z",
  "updated_at": "2026-05-21T10:30:00.000Z",
  "resolved_at": null,
  "assigned_to": null,
  "tags": ["urgent", "login"],
  "metadata": {
    "source": "api",
    "browser": null,
    "device_type": "desktop"
  },
  "classification": null
}
```

**With Auto-Classification (autoClassify=true):**
```bash
curl -X POST "http://localhost:3000/tickets?autoClassify=true" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust_123",
    "customer_email": "user@example.com",
    "customer_name": "John Doe",
    "subject": "Cannot log in to account",
    "description": "I have tried logging in multiple times but keep getting an error. This is critical."
  }'
```

**Response:** 201 Created (with classification)
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "customer_id": "cust_123",
  "customer_email": "user@example.com",
  "customer_name": "John Doe",
  "subject": "Cannot log in to account",
  "description": "I have tried logging in multiple times but keep getting an error. This is critical.",
  "category": "account_access",
  "priority": "urgent",
  "status": "new",
  "created_at": "2026-05-21T10:30:00.000Z",
  "updated_at": "2026-05-21T10:30:00.000Z",
  "resolved_at": null,
  "assigned_to": null,
  "tags": [],
  "metadata": {
    "source": "api",
    "browser": null,
    "device_type": "desktop"
  },
  "classification": {
    "method": "auto",
    "confidence": 0.95,
    "reasoning": "Keywords match account access category",
    "keywords": ["cannot log in", "critical"],
    "classified_at": "2026-05-21T10:30:00.000Z"
  }
}
```

**Error: 400 Bad Request (Validation Failed)**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "customer_email",
      "message": "customer_email must be a valid email address"
    },
    {
      "field": "subject",
      "message": "subject must be 1-200 characters"
    }
  ]
}
```

---

### Bulk Import Tickets

#### POST /tickets/import

Import multiple tickets from CSV, JSON, or XML. The importer detects the format automatically or via the `format` parameter. Returns a summary with success/failure counts and per-record errors.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `autoClassify` | boolean | If `true`, automatically classify imported tickets (optional) |
| `auto_classify` | boolean | Alternative spelling for `autoClassify` (optional) |

**Request Body:**
```json
{
  "format": "string (optional, one of: csv, json, xml; auto-detected from filename if omitted)",
  "filename": "string (optional, used for format detection; e.g. 'tickets.csv')",
  "content": "string or object (required; raw file text or parsed object)"
}
```

**CSV Example:**
```bash
curl -X POST http://localhost:3000/tickets/import \
  -H "Content-Type: application/json" \
  -d '{
    "format": "csv",
    "filename": "tickets.csv",
    "content": "customer_id,customer_email,customer_name,subject,description\ncust_001,alice@example.com,Alice Smith,Login issue,Cannot access my account\ncust_002,bob@example.com,Bob Jones,Billing question,When will I be charged?"
  }'
```

**JSON Example:**
```bash
curl -X POST http://localhost:3000/tickets/import \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json",
    "content": [
      {
        "customer_id": "cust_001",
        "customer_email": "alice@example.com",
        "customer_name": "Alice Smith",
        "subject": "Login issue",
        "description": "Cannot access my account after password reset"
      }
    ]
  }'
```

**XML Example:**
```bash
curl -X POST http://localhost:3000/tickets/import \
  -H "Content-Type: application/json" \
  -d '{
    "format": "xml",
    "content": "<?xml version=\"1.0\"?><tickets><ticket><customer_id>cust_001</customer_id><customer_email>alice@example.com</customer_email><customer_name>Alice Smith</customer_name><subject>Login issue</subject><description>Cannot access my account</description></ticket></tickets>"
  }'
```

**Response:** 201 Created
```json
{
  "format": "csv",
  "total": 10,
  "successful": 8,
  "failed": 2,
  "errors": [
    {
      "index": 3,
      "errors": [
        {
          "field": "customer_email",
          "message": "customer_email must be a valid email address"
        }
      ]
    },
    {
      "index": 7,
      "errors": [
        {
          "field": "description",
          "message": "description must be 10-2000 characters"
        }
      ]
    }
  ],
  "auto_classified": false,
  "imported": [
    "550e8400-e29b-41d4-a716-446655440000",
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002",
    "550e8400-e29b-41d4-a716-446655440003",
    "550e8400-e29b-41d4-a716-446655440004",
    "550e8400-e29b-41d4-a716-446655440005",
    "550e8400-e29b-41d4-a716-446655440006",
    "550e8400-e29b-41d4-a716-446655440007"
  ]
}
```

**Error: 400 Bad Request (Unsupported Format)**
```json
{
  "error": "Unsupported import format \"txt\". Use one of: csv, json, xml."
}
```

**Error: 400 Bad Request (Malformed Content)**
```json
{
  "error": "Import content is empty."
}
```

---

### List Tickets

#### GET /tickets

Retrieve all tickets with optional filtering and pagination.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Filter by category (one of: account_access, technical_issue, billing_question, feature_request, bug_report, other) |
| `priority` | string | Filter by priority (one of: urgent, high, medium, low) |
| `status` | string | Filter by status (one of: new, in_progress, waiting_customer, resolved, closed) |
| `assigned_to` | string | Filter by assigned person (exact match) |
| `source` | string | Filter by metadata.source (one of: web_form, email, api, chat, phone) |
| `device_type` | string | Filter by metadata.device_type (one of: desktop, mobile, tablet) |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Results per page (default: 10) |

**Request:**
```bash
curl -X GET "http://localhost:3000/tickets?status=new&priority=urgent&page=1&limit=10"
```

**Response:** 200 OK
```json
{
  "tickets": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "customer_id": "cust_123",
      "customer_email": "user@example.com",
      "customer_name": "John Doe",
      "subject": "Cannot log in to account",
      "description": "I have tried logging in multiple times but keep getting an error. This is critical.",
      "category": "account_access",
      "priority": "urgent",
      "status": "new",
      "created_at": "2026-05-21T10:30:00.000Z",
      "updated_at": "2026-05-21T10:30:00.000Z",
      "resolved_at": null,
      "assigned_to": "support_agent_1",
      "tags": ["urgent", "login"],
      "metadata": {
        "source": "api",
        "browser": null,
        "device_type": "desktop"
      },
      "classification": null
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "pages": 5
  }
}
```

---

### Fetch a Single Ticket

#### GET /tickets/:id

Retrieve a specific ticket by ID.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Request:**
```bash
curl -X GET http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000
```

**Response:** 200 OK
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "customer_id": "cust_123",
  "customer_email": "user@example.com",
  "customer_name": "John Doe",
  "subject": "Cannot log in to account",
  "description": "I have tried logging in multiple times but keep getting an error.",
  "category": "account_access",
  "priority": "high",
  "status": "in_progress",
  "created_at": "2026-05-21T10:30:00.000Z",
  "updated_at": "2026-05-21T11:45:00.000Z",
  "resolved_at": null,
  "assigned_to": "support_agent_1",
  "tags": ["urgent", "login"],
  "metadata": {
    "source": "web_form",
    "browser": "Chrome",
    "device_type": "desktop"
  },
  "classification": {
    "method": "auto",
    "confidence": 0.92,
    "reasoning": "Keywords match account access category",
    "keywords": ["cannot log in", "critical"],
    "classified_at": "2026-05-21T10:30:00.000Z"
  }
}
```

**Error: 404 Not Found**
```json
{
  "error": "Not found",
  "message": "Ticket 550e8400-e29b-41d4-a716-446655440999 does not exist"
}
```

---

### Update a Ticket

#### PUT /tickets/:id

Update one or more fields of an existing ticket. Supports partial updates (all fields optional).

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Request Body:**
All fields are optional. Only provided fields are updated.
```json
{
  "customer_id": "string (optional)",
  "customer_email": "string (optional)",
  "customer_name": "string (optional)",
  "subject": "string (optional, 1–200 characters if provided)",
  "description": "string (optional, 10–2000 characters if provided)",
  "category": "string (optional, one of: account_access, technical_issue, billing_question, feature_request, bug_report, other)",
  "priority": "string (optional, one of: urgent, high, medium, low)",
  "status": "string (optional, one of: new, in_progress, waiting_customer, resolved, closed)",
  "assigned_to": "string (optional, nullable)",
  "tags": ["string"] (optional, array of strings),
  "metadata": {
    "source": "string (optional, one of: web_form, email, api, chat, phone)",
    "browser": "string (optional, nullable)",
    "device_type": "string (optional, one of: desktop, mobile, tablet)"
  }
}
```

**Request:**
```bash
curl -X PUT http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "assigned_to": "support_agent_1",
    "priority": "high"
  }'
```

**Response:** 200 OK
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "customer_id": "cust_123",
  "customer_email": "user@example.com",
  "customer_name": "John Doe",
  "subject": "Cannot log in to account",
  "description": "I have tried logging in multiple times but keep getting an error.",
  "category": "account_access",
  "priority": "high",
  "status": "in_progress",
  "created_at": "2026-05-21T10:30:00.000Z",
  "updated_at": "2026-05-21T11:45:00.000Z",
  "resolved_at": null,
  "assigned_to": "support_agent_1",
  "tags": ["urgent", "login"],
  "metadata": {
    "source": "web_form",
    "browser": "Chrome",
    "device_type": "desktop"
  },
  "classification": null
}
```

**Note:** When `status` is changed to `resolved` or `closed`, the `resolved_at` timestamp is automatically set (if not already set). Otherwise, `resolved_at` is cleared.

**Error: 404 Not Found**
```json
{
  "error": "Not found",
  "message": "Ticket 550e8400-e29b-41d4-a716-446655440999 does not exist"
}
```

**Error: 400 Bad Request (Validation Failed)**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "priority",
      "message": "priority must be one of: urgent, high, medium, low"
    }
  ]
}
```

---

### Delete a Ticket

#### DELETE /tickets/:id

Permanently delete a ticket.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Request:**
```bash
curl -X DELETE http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000
```

**Response:** 204 No Content
(Empty response body)

**Error: 404 Not Found**
```json
{
  "error": "Not found",
  "message": "Ticket 550e8400-e29b-41d4-a716-446655440999 does not exist"
}
```

---

### Auto-Classify a Ticket

#### POST /tickets/:id/auto-classify

Classify a ticket using AI, or apply a manual override of the category and/or priority.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Ticket UUID |

**Request Body (Auto-Classification):**
Empty or omit the body to use automatic classification.
```bash
curl -X POST http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000/auto-classify \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Request Body (Manual Override):**
Provide one or both of `category` and `priority` to apply a manual override.
```json
{
  "category": "string (optional, one of: account_access, technical_issue, billing_question, feature_request, bug_report, other)",
  "priority": "string (optional, one of: urgent, high, medium, low)"
}
```

```bash
curl -X POST http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000/auto-classify \
  -H "Content-Type: application/json" \
  -d '{
    "category": "billing_question",
    "priority": "medium"
  }'
```

**Response (Auto-Classification):** 200 OK
```json
{
  "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
  "method": "auto",
  "classification": {
    "category": "account_access",
    "priority": "urgent",
    "confidence": 0.95,
    "reasoning": "Keywords match account access category; urgent keywords detected",
    "keywords": ["cannot log in", "critical", "locked out"]
  },
  "ticket": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "customer_id": "cust_123",
    "customer_email": "user@example.com",
    "customer_name": "John Doe",
    "subject": "Cannot log in to account",
    "description": "I have tried logging in multiple times but keep getting an error. This is critical.",
    "category": "account_access",
    "priority": "urgent",
    "status": "new",
    "created_at": "2026-05-21T10:30:00.000Z",
    "updated_at": "2026-05-21T10:30:00.000Z",
    "resolved_at": null,
    "assigned_to": null,
    "tags": [],
    "metadata": {
      "source": "api",
      "browser": null,
      "device_type": "desktop"
    },
    "classification": {
      "method": "auto",
      "confidence": 0.95,
      "reasoning": "Keywords match account access category; urgent keywords detected",
      "keywords": ["cannot log in", "critical", "locked out"],
      "classified_at": "2026-05-21T10:30:00.000Z"
    }
  }
}
```

**Response (Manual Override):** 200 OK
```json
{
  "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
  "method": "manual",
  "classification": {
    "category": "billing_question",
    "priority": "medium",
    "confidence": 1,
    "reasoning": "Manual override applied by an operator.",
    "keywords": []
  },
  "ticket": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "customer_id": "cust_123",
    "customer_email": "user@example.com",
    "customer_name": "John Doe",
    "subject": "Cannot log in to account",
    "description": "I have tried logging in multiple times but keep getting an error.",
    "category": "billing_question",
    "priority": "medium",
    "status": "new",
    "created_at": "2026-05-21T10:30:00.000Z",
    "updated_at": "2026-05-21T10:30:00.000Z",
    "resolved_at": null,
    "assigned_to": null,
    "tags": [],
    "metadata": {
      "source": "api",
      "browser": null,
      "device_type": "desktop"
    },
    "classification": {
      "method": "manual",
      "confidence": 1,
      "reasoning": "Manual override applied by an operator.",
      "keywords": [],
      "classified_at": "2026-05-21T10:30:00.000Z"
    }
  }
}
```

**Error: 404 Not Found**
```json
{
  "error": "Not found",
  "message": "Ticket 550e8400-e29b-41d4-a716-446655440999 does not exist"
}
```

**Error: 400 Bad Request (Invalid Override)**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "category",
      "message": "category must be one of: account_access, technical_issue, billing_question, feature_request, bug_report, other"
    }
  ]
}
```

---

## Ticket Data Model

Complete reference for all ticket fields, their types, and constraints.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | string (UUID) | Read-only | Auto-generated |
| `customer_id` | string | Required, non-empty | Customer identifier |
| `customer_email` | string | Required, valid email | Must match RFC-5322 pattern |
| `customer_name` | string | Required, non-empty | Customer full name |
| `subject` | string | Required, 1–200 characters | Ticket title |
| `description` | string | Required, 10–2000 characters | Detailed problem description |
| `category` | string | Optional, enum | One of: `account_access`, `technical_issue`, `billing_question`, `feature_request`, `bug_report`, `other` (default: `other`) |
| `priority` | string | Optional, enum | One of: `urgent`, `high`, `medium`, `low` (default: `medium`) |
| `status` | string | Optional, enum | One of: `new`, `in_progress`, `waiting_customer`, `resolved`, `closed` (default: `new`) |
| `created_at` | string (ISO 8601) | Read-only | Ticket creation timestamp |
| `updated_at` | string (ISO 8601) | Auto-updated | Latest update timestamp |
| `resolved_at` | string (ISO 8601) \| null | Auto-managed | Set when status becomes `resolved` or `closed`; cleared otherwise |
| `assigned_to` | string \| null | Optional | Name or ID of assigned support agent |
| `tags` | array of strings | Optional | Custom labels |
| `metadata` | object | Optional | Sub-object with `source`, `browser`, `device_type` |
| `metadata.source` | string | Optional, enum | One of: `web_form`, `email`, `api`, `chat`, `phone` (default: `api`) |
| `metadata.browser` | string \| null | Optional | Browser name or version |
| `metadata.device_type` | string | Optional, enum | One of: `desktop`, `mobile`, `tablet` (default: `desktop`) |
| `classification` | object \| null | Auto-managed | Classification result (method, confidence, reasoning, keywords, classified_at) |

---

## Error Handling

All errors return a JSON response with an `error` field and optional `details` or `message` fields.

### Validation Error (400 Bad Request)
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "fieldname",
      "message": "Descriptive error message"
    }
  ]
}
```

### Not Found (404)
```json
{
  "error": "Not found",
  "message": "Ticket <id> does not exist"
}
```

### Import Error (400 Bad Request)
```json
{
  "error": "Unsupported import format \"xyz\". Use one of: csv, json, xml."
}
```

### Malformed JSON (400 Bad Request)
```json
{
  "error": "Unexpected token } in JSON at position 42"
}
```

---

## Classification Response Format

When a ticket is classified (either automatically or manually), the response includes a `classification` object:

```json
{
  "method": "auto" | "manual",
  "confidence": 0.0 - 1.0,
  "reasoning": "string explaining the classification decision",
  "keywords": ["array", "of", "matched", "keywords"],
  "classified_at": "2026-05-21T10:30:00.000Z"
}
```

For manual overrides, `confidence` is always `1` and `keywords` is always an empty array.

---

## Rate Limiting & Constraints

- **JSON payload limit:** 5 MB
- **Import CSV/JSON/XML:** No hard limit per request (governed by 5 MB payload)
- **Pagination:** Default limit 10, max configurable
- **Concurrent requests:** No limit enforced at the API level

---

## Status Codes Summary

| Code | Meaning |
|------|---------|
| 200 | OK — successful read or update |
| 201 | Created — successful ticket or import creation |
| 204 | No Content — successful deletion (no response body) |
| 400 | Bad Request — validation error, malformed JSON, unsupported format |
| 404 | Not Found — ticket does not exist |

---

## Example Workflows

### Create and Auto-Classify a Ticket

```bash
curl -X POST "http://localhost:3000/tickets?autoClassify=true" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust_456",
    "customer_email": "jane@example.com",
    "customer_name": "Jane Smith",
    "subject": "Billing discrepancy on invoice",
    "description": "I was charged twice for my subscription this month. Please refund the duplicate charge.",
    "metadata": {
      "source": "email",
      "device_type": "mobile"
    }
  }'
```

### Import Multiple Tickets and Auto-Classify

```bash
curl -X POST "http://localhost:3000/tickets/import?autoClassify=true" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json",
    "content": [
      {
        "customer_id": "cust_001",
        "customer_email": "alice@example.com",
        "customer_name": "Alice",
        "subject": "App crashes on startup",
        "description": "The app crashes immediately after launching on my iPhone."
      },
      {
        "customer_id": "cust_002",
        "customer_email": "bob@example.com",
        "customer_name": "Bob",
        "subject": "Feature request: dark mode",
        "description": "Please add a dark mode option to the app for nighttime usage."
      }
    ]
  }'
```

### List High-Priority Tickets Assigned to an Agent

```bash
curl -X GET "http://localhost:3000/tickets?priority=urgent&priority=high&assigned_to=support_agent_1&status=in_progress"
```

### Update and Manually Classify

```bash
# First, update the ticket status
curl -X PUT http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress",
    "assigned_to": "support_agent_2"
  }'

# Then, manually override the classification
curl -X POST http://localhost:3000/tickets/550e8400-e29b-41d4-a716-446655440000/auto-classify \
  -H "Content-Type: application/json" \
  -d '{
    "category": "technical_issue",
    "priority": "high"
  }'
```

---

**Last updated:** May 21, 2026
