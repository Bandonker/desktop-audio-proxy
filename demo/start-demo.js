#!/usr/bin/env node

/**
 * Demo Startup Script
 * Starts both the proxy server and a local web server for the demo
 */

import { spawn } from 'child_process';
import path from 'path';
import http from 'http';
import fs from 'fs';
import { fileURLToPath, URL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MIME types for serving files
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript', 
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.map': 'application/json'
};

const legacyRedirects = {
    '/examples/react-video-player.tsx': '/examples/react-example.tsx'
};

class DemoServer {
    constructor() {
        this.proxyProcess = null;
        this.webServer = null;
        this.demoPort = 8080;
        this.proxyPort = 3002;
        this.projectRoot = path.join(__dirname, '..');
        this.npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        this.nodeCommand = process.execPath;
    }

    async start() {
        console.log('🚀 Starting Desktop Audio Proxy Demo...\n');

        try {
            // 1. Build the library first
            console.log('📦 Building library...');
            await this.buildLibrary();

            // 2. Start proxy server
            console.log('🔧 Starting proxy server...');
            await this.startProxyServer();

            // 3. Start web server for demo
            console.log('🌐 Starting demo web server...');
            await this.startWebServer();

            // 4. Show instructions
            this.showInstructions();

            // 5. Handle shutdown
            this.setupShutdown();

        } catch (error) {
            console.error('❌ Failed to start demo:', error);
            process.exit(1);
        }
    }

    buildLibrary() {
        return new Promise((resolve, reject) => {
            const command = process.platform === 'win32' ? 'cmd.exe' : this.npmCommand;
            const args = process.platform === 'win32'
                ? ['/d', '/s', '/c', 'npm run build']
                : ['run', 'build'];

            const build = spawn(command, args, {
                cwd: this.projectRoot,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            build.stdout.on('data', (data) => {
                process.stdout.write(data);
            });

            build.stderr.on('data', (data) => {
                process.stderr.write(data);
            });

            build.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Build failed with code ${code}`));
                }
            });
        });
    }

    startProxyServer() {
        return new Promise((resolve, reject) => {
            let settled = false;
            const timeoutId = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    reject(new Error('Proxy server startup timeout'));
                }
            }, 30000);

            const finish = (fn, value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                fn(value);
            };

            // Start the proxy server
            this.proxyProcess = spawn(this.nodeCommand, ['examples/standalone-server.js'], {
                cwd: this.projectRoot,
                stdio: 'pipe'
            });

            this.proxyProcess.stdout.on('data', (data) => {
                const output = data.toString();
                console.log(`[Proxy] ${output.trim()}`);
                
                // Extract the actual runtime port first (e.g. running on http://0.0.0.0:3003)
                const runtimePortMatch = output.match(/running on http:\/\/(?:0\.0\.0\.0|localhost):(\d+)/i);
                if (runtimePortMatch) {
                    this.proxyPort = parseInt(runtimePortMatch[1], 10);
                    console.log(`[Proxy] Detected actual proxy port: ${this.proxyPort}`);
                } else {
                    const healthPortMatch = output.match(/health check:\s*http:\/\/localhost:(\d+)/i);
                    if (healthPortMatch) {
                        this.proxyPort = parseInt(healthPortMatch[1], 10);
                    }
                }
                
                if (output.includes('Server started successfully')) {
                    finish(resolve);
                }
            });

            this.proxyProcess.stderr.on('data', (data) => {
                console.error(`[Proxy Error] ${data.toString().trim()}`);
            });

            this.proxyProcess.on('close', (code) => {
                if (!settled && code !== 0) {
                    finish(reject, new Error(`Proxy server exited with code ${code}`));
                }
            });
            
            this.proxyProcess.on('spawn', () => {
                console.log('[Proxy] Process spawned successfully');
            });
        });
    }

    startWebServer() {
        console.log(`🌐 Server attempting to start on port ${this.demoPort}...`);
        return new Promise((resolve, reject) => {
            this.webServer = http.createServer((req, res) => {
                this.handleRequest(req, res);
            });

            this.webServer.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    console.log(`⚠️  Port ${this.demoPort} is in use, trying next port...`);
                    this.demoPort++;
                    this.webServer.listen(this.demoPort);
                } else {
                    console.error('❌ Web server error:', err);
                    reject(err);
                }
            });

            this.webServer.on('listening', () => {
                console.log(`✅ Web server is now listening on port ${this.demoPort}`);
                resolve();
            });

            this.webServer.listen(this.demoPort);
        });
    }

    handleRequest(req, res) {
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        let pathname;
        try {
            pathname = decodeURIComponent(parsedUrl.pathname);
        } catch {
            res.writeHead(400);
            res.end('Invalid URL encoding');
            return;
        }

        // Backward compatibility redirects for moved demo/example files.
        if (legacyRedirects[pathname]) {
            const location = legacyRedirects[pathname];
            console.log(`[WebServer] ${req.method} ${pathname} -> 302 ${location}`);
            res.writeHead(302, { Location: location });
            res.end(`Redirecting to ${location}`);
            return;
        }
        
        // Default to index.html
        if (pathname === '/') {
            pathname = '/index.html';
        }

        // Handle requests for dist, assets, and examples files (go up one directory)
        let baseDir;
        if (pathname.startsWith('/dist/') || pathname.startsWith('/assets/') || pathname.startsWith('/examples/')) {
            baseDir = this.projectRoot;
        } else {
            baseDir = __dirname;
        }

        const normalizedPath = path.normalize(pathname).replace(/^[/\\]+/, '');
        const filePath = path.resolve(baseDir, normalizedPath);
        const resolvedBaseDir = path.resolve(baseDir);
        if (!filePath.startsWith(resolvedBaseDir + path.sep) && filePath !== resolvedBaseDir) {
            console.error(`[WebServer] ❌ Path traversal blocked: ${pathname}`);
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        const ext = path.parse(filePath).ext;
        const mimeType = mimeTypes[ext] || 'text/plain';

        // Add CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // Log the request with more detail
        console.log(`[WebServer] ${req.method} ${pathname} -> ${filePath} (${mimeType})`);

        if (!fs.existsSync(filePath)) {
            console.error(`[WebServer] ❌ File not found: ${filePath}`);
            res.writeHead(404);
            res.end(`File not found: ${pathname}`);
            return;
        }

        fs.readFile(filePath, (err, data) => {
            if (err) {
                console.error(`[WebServer] ❌ Server error reading ${filePath}: ${err.message}`);
                res.writeHead(500);
                res.end(`Server error: ${err.message}`);
            } else {
                res.writeHead(200, { 
                    'Content-Type': mimeType,
                    'Content-Length': data.length,
                    'Cache-Control': 'no-cache'
                });
                res.end(data);
            }
        });
    }

    showInstructions() {
        console.log('\n🎉 Demo is ready!\n');
        console.log('📱 Open your browser and go to:');
        console.log(`   http://localhost:${this.demoPort}`);
        console.log('\n🔧 Services running:');
        console.log(`   • Demo Web Server: http://localhost:${this.demoPort}`);
        console.log(`   • Audio Proxy Server: http://localhost:${this.proxyPort || 'unknown'}`);
        
        if (this.proxyPort && this.proxyPort !== 3002) {
            console.log(`\n⚠️  Note: Proxy is running on port ${this.proxyPort}, not 3002 due to port conflict`);
        }
        console.log('\n For developers:');
        console.log('   • Open browser dev tools to inspect the real implementation');
        console.log('   • Check console for window.dapDemo object');
        console.log('   • View Network tab to see proxy requests');
        console.log('\n Press Ctrl+C to stop all services\n');
    }

    setupShutdown() {
        const shutdown = () => {
            console.log('\nShutting down demo...');
            
            if (this.proxyProcess) {
                this.proxyProcess.kill('SIGTERM');
            }
            
            if (this.webServer) {
                this.webServer.close();
            }
            
            process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    }
}

// Start demo
console.log('Script starting...');
const demo = new DemoServer();
demo.start().catch(err => {
    console.error('Fatal error starting demo:', err);
    process.exit(1);
});

export default DemoServer;
