# Security Policy

## Supported Versions

The following versions of **Keyframe Character Studio** are currently supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

---

## Reporting a Vulnerability

We take the security of Keyframe Character Studio seriously. If you discover a security vulnerability, please follow these steps:

1. **Do NOT open a public GitHub issue** for security vulnerabilities.
2. Email a detailed vulnerability report to the repository maintainer.
3. Include the following details in your report:
   - Type of vulnerability (e.g., XSS, CORS misconfiguration, SQL injection)
   - Steps to reproduce the issue
   - Potential impact and affected components (e.g., Express REST API, PostgreSQL/SQLite queries)
   - Proof-of-concept code or payload, if available

---

## Security Practices in Keyframe Character Studio

- **Environment Variables**: Sensitive configuration parameters (database credentials, API keys) must be stored in `.env` files and never committed to version control.
- **REST API Payload Limits**: The Express backend enforces explicit JSON body payload limits (`50mb`).
- **SQL Injection Prevention**: Database queries use parameterized placeholders (`$1`, `$2` for PostgreSQL; `?` for SQLite).
- **CORS Protection**: CORS middleware is configured explicitly in `server/index.js`.
