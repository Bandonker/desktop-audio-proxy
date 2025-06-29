# Security Policy

## Supported Versions

We actively support the following versions of desktop-audio-proxy with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability in desktop-audio-proxy, please report it to us in a responsible manner.

### How to Report

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. **Create a private security advisory** on GitHub:
   - Go to the Security tab in this repository
   - Click "Report a vulnerability" 
   - Fill out the security advisory form with:
     - A clear description of the vulnerability
     - Steps to reproduce the issue
     - Potential impact assessment
     - Any suggested fixes (if available)

### What to Include

Please include as much of the following information as possible:

- **Vulnerability Type**: CORS bypass, code injection, etc.
- **Affected Components**: Client, server, specific services
- **Environment**: Tauri/Electron/Web, OS, Node.js version
- **Reproduction Steps**: Clear, step-by-step instructions
- **Impact**: What could an attacker achieve?
- **Proof of Concept**: If applicable (but please be responsible)

### Response Timeline

- **1-2 weeks**: Initial acknowledgment and review of your report
- **2-4 weeks**: Assessment and severity classification
- **4-8 weeks**: Planned timeline for fixes (depending on complexity)
- **Best effort basis**: We're a small open source project, so timelines may vary based on availability

### Security Considerations

When using desktop-audio-proxy, please be aware of these security considerations:

#### Proxy Server Security
- The proxy server should only be run in trusted environments
- Configure appropriate CORS settings for your use case
- Use HTTPS when possible, especially in production
- Limit proxy server access to necessary origins only

#### URL Handling
- Be cautious with user-provided URLs
- Validate and sanitize URLs before processing
- Consider implementing URL allowlists for production use

#### Electron/Tauri Integration
- Follow security best practices for your desktop framework
- Use context isolation and disable node integration in renderers
- Validate all IPC communications
- Implement proper Content Security Policy (CSP)

### Scope

This security policy covers vulnerabilities in:
- Core library code (`src/`)
- Server implementation (`server.ts`, `server-impl.ts`)
- Client implementation (`client.ts`)
- Environment-specific services (`tauri-service.ts`, `electron-service.ts`)
- Build and distribution processes

**Out of scope:**
- Vulnerabilities in third-party dependencies (report to respective maintainers)
- Issues in example code (unless they demonstrate library vulnerabilities)
- General Electron/Tauri security issues unrelated to our library

### Recognition

We appreciate responsible disclosure and will acknowledge security researchers who help improve the security of desktop-audio-proxy:

- Public acknowledgment in release notes (with your permission)
- Recognition in our security hall of fame
- Direct communication throughout the resolution process

### Additional Resources

- [Electron Security Guidelines](https://www.electronjs.org/docs/tutorial/security)
- [Tauri Security Guidelines](https://tauri.app/v1/guides/building/app-security)
- [OWASP Secure Coding Practices](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/)

Thank you for helping keep desktop-audio-proxy and our users safe!