#!/usr/bin/env node

/**
 * Demo Startup Script
 * Starts both the proxy server and a local web server for the demo
 */

import { spawn } from 'child_process';
import path from 'path';
import http from 'http';
import fs from 'fs';
import url from 'url';
import { fileURLToPath } from 'url';

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

class DemoServer {
    constructor() {
        this.proxyProcess = null;
        this.webServer = null;
        this.demoPort = 8080;
        this.proxyPort = 3002;
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
            const build = spawn('npm', ['run', 'build'], {
                cwd: path.join(__dirname, '..'),
                stdio: 'inherit'
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
            // Start the proxy server
            this.proxyProcess = spawn('node', ['examples/standalone-server.js'], {
                cwd: path.join(__dirname, '..'),
                stdio: 'pipe'
            });

            this.proxyProcess.stdout.on('data', (data) => {
                const output = data.toString();
                console.log(`[Proxy] ${output.trim()}`);
                
                // Extract the actual port from the output
                const portMatch = output.match(/http:\/\/localhost:(\d+)/);
                if (portMatch) {
                    this.proxyPort = parseInt(portMatch[1]);
                    console.log(`[Proxy] Detected actual proxy port: ${this.proxyPort}`);
                }
                
                if (output.includes('Server started successfully') || output.includes('running on http://localhost')) {
                    resolve();
                }
            });

            this.proxyProcess.stderr.on('data', (data) => {
                console.error(`[Proxy Error] ${data.toString().trim()}`);
            });

            this.proxyProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Proxy server exited with code ${code}`));
                }
            });

            // Timeout if proxy doesn't start
            setTimeout(() => {
                reject(new Error('Proxy server startup timeout'));
            }, 10000);
        });
    }

    startWebServer() {
        return new Promise((resolve, reject) => {
            this.webServer = http.createServer((req, res) => {
                this.handleRequest(req, res);
            });

            this.webServer.listen(this.demoPort, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    handleRequest(req, res) {
        let pathname = url.parse(req.url).pathname;
        
        // Default to index.html
        if (pathname === '/') {
            pathname = '/index.html';
        }

        // Handle requests for dist files (go up one directory)
        let filePath;
        if (pathname.startsWith('/dist/')) {
            filePath = path.join(__dirname, '..', pathname);
        } else if (pathname.startsWith('/assets/')) {
            filePath = path.join(__dirname, '..', pathname);
        } else {
            filePath = path.join(__dirname, pathname);
        }

        const ext = path.parse(filePath).ext;
        const mimeType = mimeTypes[ext] || 'text/plain';

        // Add CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        console.log(`[WebServer] ${req.method} ${pathname} -> ${filePath} (${mimeType})`);

        fs.readFile(filePath, (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    console.error(`[WebServer] File not found: ${filePath}`);
                    res.writeHead(404);
                    res.end('File not found');
                } else {
                    console.error(`[WebServer] Server error: ${err.message}`);
                    res.writeHead(500);
                    res.end('Server error');
                }
            } else {
                res.writeHead(200, { 'Content-Type': mimeType });
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

// Start demo if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const demo = new DemoServer();
    demo.start().catch(console.error);
}

export default DemoServer;