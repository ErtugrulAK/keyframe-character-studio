# Security Policy

## Supported versions

KCS is an actively developed prototype. There is no separately maintained release line or guaranteed security-support window at this time.

| Version or branch | Security fixes |
| --- | --- |
| Current development branch | Best effort during active development |
| Older commits and branches | Not supported |

## Reporting a vulnerability

Please do not disclose a security vulnerability in a public GitHub issue.

This repository currently has no verified security email address or published private response SLA. If GitHub's private vulnerability reporting or Security Advisories feature is enabled for the repository, use that private channel. Otherwise, contact the repository maintainers through an available private GitHub channel before public disclosure.

Include, when safe to share:

- affected commit, branch, or version;
- operating system, browser, and deployment context;
- reproducible steps or a minimal proof of concept;
- affected surface, such as the browser UI, Express API, import/export, or database boundary;
- potential impact and any suggested mitigation.

Please allow maintainers reasonable time to investigate before publishing details. Do not include real credentials, private project files, or personal data in a report.

## Security practices

- Keep environment variables and credentials out of Git.
- Validate imported project and preset data at external boundaries.
- Use parameterized database queries in server code.
- Review SVG, HTML, file-upload, and generated-runtime changes for injection and resource risks.
- Treat browser, localStorage, JSON, API, and database responses as untrusted input.
