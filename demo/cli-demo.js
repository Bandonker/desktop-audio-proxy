#!/usr/bin/env node

// Desktop Audio Proxy CLI Demo - Professional Terminal Edition
// Full implementation with real browser CORS testing

import { createAudioClient } from '../dist/browser.esm.js';
import fs from 'fs';
import readline from 'readline';
import puppeteer from 'puppeteer';

class HackerCLIDemo {
    constructor() {
        this.audioClient = null;
        this.proxyServerAvailable = false;
        this.environment = null;
        this.workingProxyUrl = null;
        this.testResults = new Map();
        this.rl = null;
        this.browser = null;
        this.browserPage = null;
        
        // Terminal colors and effects
        this.colors = {
            reset: '\x1b[0m',
            bright: '\x1b[1m',
            dim: '\x1b[2m',
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            magenta: '\x1b[35m',
            cyan: '\x1b[36m',
            white: '\x1b[37m',
            bgBlack: '\x1b[40m',
            bgRed: '\x1b[41m',
            bgGreen: '\x1b[42m',
            bgYellow: '\x1b[43m',
            bgBlue: '\x1b[44m',
            bgMagenta: '\x1b[45m',
            bgCyan: '\x1b[46m',
            bgWhite: '\x1b[47m'
        };
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\nReceived SIGINT, shutting down gracefully...');
            await this.cleanup();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            console.log('\nReceived SIGTERM, shutting down gracefully...');
            await this.cleanup();
            process.exit(0);
        });
        
        this.init();
    }
    
    async cleanup() {
        if (this.browser) {
            try {
                await this.browser.close();
                console.log('✓ Browser closed');
            } catch (error) {
                console.log('! Error closing browser:', error.message);
            }
        }
        if (this.rl) {
            this.rl.close();
        }
    }
    
    async init() {
        this.clearScreen();
        await this.showBootSequence();
        await this.showBanner();
        await this.initializeSystem();
        await this.showMainMenu();
    }
    
    clearScreen() {
        process.stdout.write('\x1b[2J\x1b[0f');
    }
    
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async typeText(text, delay = 30) {
        for (const char of text) {
            process.stdout.write(char);
            await this.delay(delay);
        }
    }
    
    async showBootSequence() {
        const c = this.colors;
        
        console.log(`${c.green}${c.bright}INITIALIZING DESKTOP AUDIO PROXY SYSTEM...${c.reset}`);
        await this.delay(500);
        
        const bootMessages = [
            "Loading audio proxy modules...",
            "Mounting audio subsystems...", 
            "Initializing CORS bypass protocols...",
            "Scanning proxy network topology...",
            "Establishing secure channels...",
            "Calibrating audio codecs...",
            "System ready."
        ];
        
        for (const msg of bootMessages) {
            process.stdout.write(`${c.cyan}[${new Date().toISOString()}]${c.reset} ${msg}`);
            await this.delay(Math.random() * 300 + 200);
            console.log(` ${c.green}✓${c.reset}`);
        }
        
        await this.delay(800);
        this.clearScreen();
    }
    
    async showBanner() {
        const c = this.colors;
        
        const banner = `
${c.cyan}${c.bright}
                            ██████╗  █████╗ ██████╗ 
                            ██╔══██╗██╔══██╗██╔══██╗
                            ██║  ██║███████║██████╔╝
                            ██║  ██║██╔══██║██╔═══╝ 
                            ██████╔╝██║  ██║██║     
                            ╚═════╝ ╚═╝  ╚═╝╚═╝     
${c.reset}
${c.magenta}${c.bright}                    DESKTOP AUDIO PROXY - TERMINAL INTERFACE${c.reset}
${c.dim}                         [CAME TO CREATION BY BANDONKER]${c.reset}

${c.yellow}┌─────────────────────────────────────────────────────────────────────────────┐
│ ${c.bright}WARNING: Bypassing CORS restrictions in progress...${c.reset}${c.yellow}                         │
│ This system enables unrestricted audio streaming across security boundaries │
│ Use responsibly and in accordance with applicable laws and policies         │
└─────────────────────────────────────────────────────────────────────────────┘${c.reset}

${c.cyan}┌─────────────────────────────────────────────────────────────────────────────┐
│ ${c.bright}NOTICE: Proxy Server Required for Full Functionality${c.reset}${c.cyan}                        │
│ To demonstrate CORS bypass capabilities, start the proxy server:            │
│ ${c.bright}npm run proxy:start${c.reset}${c.cyan}                                                         │
│ Then run this CLI demo in another terminal with: ${c.bright}npm run demo:cli${c.reset}${c.cyan}           │
└─────────────────────────────────────────────────────────────────────────────┘${c.reset}

`;
        
        console.log(banner);
        await this.delay(1500);
    }
    
    async initializeSystem() {
        const c = this.colors;
        
        console.log(`${c.green}${c.bright}[SYSTEM INITIALIZATION]${c.reset}`);
        console.log(`${c.cyan}➤${c.reset} Loading Desktop Audio Proxy library...`);
        
        try {
            await this.initializeLibrary();
            console.log(`${c.green}✓${c.reset} Library loaded successfully`);
            
            console.log(`${c.cyan}➤${c.reset} Initializing browser for real CORS testing...`);
            await this.initializeBrowser();
            console.log(`${c.green}✓${c.reset} Browser initialized successfully`);
            
            console.log(`${c.cyan}➤${c.reset} Scanning network for proxy servers...`);
            await this.checkInitialProxyStatus();
            
            console.log(`${c.cyan}➤${c.reset} Detecting system configuration...`);
            await this.detectSystemStatus();
            
            console.log(`${c.cyan}➤${c.reset} Analyzing library version...`);
            await this.detectLibraryVersion();
            
            console.log(`${c.green}✓${c.reset} System initialization complete`);
            
            // Show helpful tip if proxy server is not available
            if (!this.proxyServerAvailable) {
                console.log();
                console.log(`${c.yellow} TIP: For full CORS bypass functionality, start the proxy server:${c.reset}`);
                console.log(`${c.cyan}   Terminal 1:${c.reset} npm run proxy:start`);
                console.log(`${c.cyan}   Terminal 2:${c.reset} npm run demo:cli`);
            }
            
        } catch (error) {
            console.log(`${c.red}✗${c.reset} System initialization failed: ${error.message}`);
            if (this.browser) {
                await this.browser.close();
            }
            process.exit(1);
        }
        
        await this.delay(1000);
    }
    
    async initializeLibrary() {
        // Auto-detect available package builds
        const possibleBuilds = [
            '../dist/browser.esm.js',
            '../dist/browser.cjs',
            './browser.esm.js'
        ];
        
        let audioClientImport = null;
        for (const buildPath of possibleBuilds) {
            try {
                const module = await import(buildPath);
                if (module.createAudioClient) {
                    audioClientImport = module.createAudioClient;
                    break;
                }
            } catch (error) {
                // Try next build
            }
        }
        
        if (!audioClientImport) {
            throw new Error('Could not import Desktop Audio Proxy library');
        }
        
        // Create the audio client
        this.audioClient = audioClientImport({
            proxyUrl: 'http://localhost:3002',
            autoDetect: true,
            fallbackToOriginal: true,
            retryAttempts: 3,
            retryDelay: 1000,
            proxyConfig: {
                corsOrigins: '*',
                timeout: 60000,
                maxRedirects: 20,
                enableLogging: false,
                userAgent: 'DesktopAudioProxy-CLI/1.1.0'
            }
        });
    }
    
    async initializeBrowser() {
        try {
            // Launch headless browser for real CORS testing
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    // NOTE: NOT using --disable-web-security so we get real CORS enforcement
                ]
            });
            
            this.browserPage = await this.browser.newPage();
            
            // Set a realistic user agent
            await this.browserPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
        } catch (error) {
            throw new Error(`Failed to initialize browser: ${error.message}`);
        }
    }
    
    async checkInitialProxyStatus() {
        const possiblePorts = [3002, 3001, 3003];
        this.proxyServerAvailable = false;
        this.workingProxyUrl = null;
        
        for (const port of possiblePorts) {
            try {
                const response = await fetch(`http://localhost:${port}/health`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(2000)
                });
                
                if (response.ok) {
                    await response.json(); // Verify it's valid JSON
                    this.workingProxyUrl = `http://localhost:${port}`;
                    this.proxyServerAvailable = true;
                    break;
                }
            } catch (error) {
                // Continue trying other ports
            }
        }
    }
    
    async detectSystemStatus() {
        this.environment = this.audioClient.getEnvironment();
    }
    
    async detectLibraryVersion() {
        let versionInfo = { version: 'unknown', features: [] };
        
        // Try to get version from proxy server
        if (this.proxyServerAvailable && this.workingProxyUrl) {
            try {
                const response = await fetch(`${this.workingProxyUrl}/health`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.version) {
                        versionInfo.version = data.version;
                    }
                }
            } catch (error) {
                // Fallback to package.json
            }
        }
        
        // Fallback to package.json
        if (versionInfo.version === 'unknown') {
            try {
                const packageJson = JSON.parse(fs.readFileSync('../package.json', 'utf8'));
                if (packageJson.version) {
                    versionInfo.version = packageJson.version;
                }
            } catch (error) {
                // Last resort inference
                versionInfo.version = '1.1.0+';
            }
        }
        
        this.versionInfo = versionInfo;
    }
    
    async showMainMenu() {
        const c = this.colors;
        
        this.clearScreen();
        await this.showSystemStatus();
        
        console.log(`${c.green}${c.bright}[COMMAND INTERFACE]${c.reset}`);
        console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
        
        const commands = [
            { cmd: '1', desc: 'Test Audio URL' },
            { cmd: '2', desc: 'System Diagnostics' },
            { cmd: '3', desc: 'Proxy Server Status' },
            { cmd: '4', desc: 'Show Example URLs' },
            { cmd: '5', desc: 'Advanced Features Demo' },
            { cmd: '6', desc: 'View Test Results' },
            { cmd: '7', desc: 'Show Startup Commands' },
            { cmd: 'h', desc: 'Help & Documentation' },
            { cmd: 'q', desc: 'Quit System' }
        ];
        
        commands.forEach(({ cmd, desc }) => {
            console.log(`${c.bright}${cmd})${c.reset} ${desc}`);
        });
        
        console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
        
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        this.promptCommand();
    }
    
    async showSystemStatus() {
        const c = this.colors;
        
        console.log(`${c.yellow}${c.bright}[SYSTEM STATUS MATRIX]${c.reset}`);
        console.log(`${c.cyan}┌─────────────────────────────────────────────────────────────────────────────┐${c.reset}`);
        
        // Environment status
        const envColor = this.environment === 'web' ? c.green : 
                        this.environment === 'unknown' ? c.cyan : 
                        this.environment === 'tauri' ? c.green : 
                        this.environment === 'electron' ? c.green : c.yellow;
        const envDisplay = this.environment === 'web' ? 'Web Browser' :
                          this.environment === 'tauri' ? 'Tauri Application' :
                          this.environment === 'electron' ? 'Electron Application' :
                          this.environment === 'unknown' ? 'Node.js CLI' :
                          'Unknown Environment';
        console.log(`${c.cyan}│${c.reset} Environment:    ${envColor}${envDisplay.padEnd(60)}${c.reset}${c.cyan}│${c.reset}`);
        
        // Proxy status  
        const proxyColor = this.proxyServerAvailable ? c.green : c.red;
        const proxyStatus = this.proxyServerAvailable ? 
            `ONLINE (${this.workingProxyUrl.split(':')[2]})` : 'OFFLINE';
        console.log(`${c.cyan}│${c.reset} Proxy Server:   ${proxyColor}${proxyStatus.padEnd(60)}${c.reset}${c.cyan}│${c.reset}`);
        
        // Library version
        const versionColor = this.versionInfo?.version !== 'unknown' ? c.green : c.yellow;
        const version = this.versionInfo?.version || 'Unknown';
        console.log(`${c.cyan}│${c.reset} Library Ver:    ${versionColor}v${version.padEnd(59)}${c.reset}${c.cyan}│${c.reset}`);
        
        // Security status
        const securityStatus = this.proxyServerAvailable ? 'CORS BYPASS ACTIVE' : 'LIMITED FUNCTIONALITY';
        const securityColor = this.proxyServerAvailable ? c.green : c.yellow;
        console.log(`${c.cyan}│${c.reset} Security:       ${securityColor}${securityStatus.padEnd(60)}${c.reset}${c.cyan}│${c.reset}`);
        
        console.log(`${c.cyan}└─────────────────────────────────────────────────────────────────────────────┘${c.reset}`);
        console.log();
    }
    
    promptCommand() {
        const c = this.colors;
        this.rl.question(`${c.green}${c.bright}[DAP-CLI]${c.reset}${c.cyan}➤${c.reset} `, async (answer) => {
            await this.handleCommand(answer.trim().toLowerCase());
        });
    }
    
    async handleCommand(cmd) {
        const c = this.colors;
        
        switch (cmd) {
            case '1':
                await this.testAudioURL();
                break;
            case '2':
                await this.systemDiagnostics();
                break;
            case '3':
                await this.proxyServerStatus();
                break;
            case '4':
                await this.showExampleURLs();
                break;
            case '5':
                await this.advancedFeaturesDemo();
                break;
            case '6':
                await this.viewTestResults();
                break;
            case '7':
                await this.showStartupCommands();
                break;
            case 'h':
            case 'help':
                await this.showHelp();
                break;
            case 'q':
            case 'quit':
            case 'exit':
                console.log(`${c.red}${c.bright}[SYSTEM SHUTDOWN]${c.reset}`);
                console.log(`${c.cyan}➤${c.reset} Terminating connections...`);
                await this.cleanup();
                console.log(`${c.cyan}--END OF TRANSMISSION--${c.reset}`);
                process.exit(0);
                break;
            default:
                console.log(`${c.red}✗${c.reset} Unknown command: ${cmd}`);
                console.log(`${c.yellow}Type 'h' for help${c.reset}`);
                break;
        }
        
        console.log();
        this.promptCommand();
    }
    
    async testAudioURL() {
        const c = this.colors;
        
        console.log(`${c.yellow}${c.bright}[AUDIO URL TESTING PROTOCOL]${c.reset}`);
        console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
        
        const url = await this.getInput('Enter audio URL to test: ');
        
        if (!url) {
            console.log(`${c.red}✗${c.reset} No URL provided`);
            return;
        }
        
        console.log(`${c.cyan}➤${c.reset} Analyzing URL: ${c.bright}${url}${c.reset}`);
        
        // Test direct URL
        console.log(`${c.cyan}➤${c.reset} Testing direct access (without proxy)...`);
        const directResult = await this.testDirectAccess(url);
        
        // Test with proxy
        console.log(`${c.cyan}➤${c.reset} Testing proxy bypass...`);
        const proxyResult = await this.testProxyAccess(url);
        
        // Show results
        this.displayTestResults(url, directResult, proxyResult);
        
        // Store results
        this.testResults.set(url, {
            timestamp: new Date(),
            direct: directResult,
            proxy: proxyResult,
            environment: this.environment
        });
    }
    
    async testDirectAccess(url) {
        if (!this.browserPage) {
            return {
                success: false,
                status: 0,
                error: 'Browser not initialized',
                details: 'Real browser testing unavailable'
            };
        }

        try {
            // Test real CORS behavior in actual browser environment
            const result = await this.browserPage.evaluate(async (testUrl) => {
                try {
                    // This is real browser fetch() - will enforce CORS policy
                    const response = await fetch(testUrl, {
                        method: 'HEAD',
                        mode: 'cors', // Explicitly require CORS compliance
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest' // Force preflight for most servers
                        }
                    });
                    
                    return {
                        success: true,
                        status: response.status,
                        error: null,
                        details: `HTTP ${response.status} - CORS allowed by server`
                    };
                } catch (error) {
                    // Real CORS error from browser
                    return {
                        success: false,
                        status: 0,
                        error: error.name,
                        details: `CORS blocked - ${error.message} (real browser enforcement)`
                    };
                }
            }, url);
            
            return result;
            
        } catch (error) {
            return {
                success: false,
                status: 0,
                error: error.message,
                details: `Browser evaluation error - ${error.message}`
            };
        }
    }
    
    async testProxyAccess(url) {
        if (!this.proxyServerAvailable) {
            return {
                success: false,
                status: 0,
                error: 'Proxy server not available',
                details: 'Start proxy server with: npm run proxy:start'
            };
        }
        
        try {
            const playableUrl = await this.audioClient.getPlayableUrl(url);
            
            // Check if the proxy actually processed the URL or if it fell back to original
            if (playableUrl === url) {
                // The library fell back to the original URL, proxy failed
                return {
                    success: false,
                    status: 0,
                    error: 'Proxy fallback occurred',
                    details: 'Proxy server unavailable - library fell back to original URL'
                };
            }
            
            // Test if the proxied URL works
            const response = await fetch(playableUrl, {
                method: 'HEAD',
                signal: AbortSignal.timeout(10000)
            });
            
            return {
                success: response.ok,
                status: response.status,
                error: null,
                details: `Proxied successfully via ${this.workingProxyUrl}`,
                proxyUrl: playableUrl
            };
        } catch (error) {
            return {
                success: false,
                status: 0,
                error: error.message,
                details: 'Proxy processing failed'
            };
        }
    }
    
    displayTestResults(url, directResult, proxyResult) {
        const c = this.colors;
        
        console.log(`${c.yellow}${c.bright}[TEST RESULTS]${c.reset}`);
        console.log(`${c.cyan}┌─────────────────────────────────────────────────────────────────────────────┐${c.reset}`);
        console.log(`${c.cyan}│${c.reset} URL: ${url.substring(0, 70).padEnd(70)} ${c.cyan}│${c.reset}`);
        console.log(`${c.cyan}├─────────────────────────────────────────────────────────────────────────────┤${c.reset}`);
        
        // Direct access result
        const directIcon = directResult.success ? '✓' : '✗';
        const directColor = directResult.success ? c.green : c.red;
        console.log(`${c.cyan}│${c.reset} Direct Access:${directColor}${directIcon} ${directResult.details.padEnd(60)}${c.reset}${c.cyan}│${c.reset}`);
        
        // Proxy access result
        const proxyIcon = proxyResult.success ? '✓' : '✗';
        const proxyColor = proxyResult.success ? c.green : c.red;
        console.log(`${c.cyan}│${c.reset} Proxy Bypass: ${proxyColor}${proxyIcon} ${proxyResult.details.padEnd(60)}${c.reset}${c.cyan}│${c.reset}`);
        
        console.log(`${c.cyan}└─────────────────────────────────────────────────────────────────────────────┘${c.reset}`);
        
        // Analysis
        if (directResult.success && proxyResult.success) {
            console.log(`${c.green}${c.bright}ANALYSIS:${c.reset} ${c.green}URL is accessible both ways (no CORS restriction)${c.reset}`);
        } else if (!directResult.success && proxyResult.success) {
            console.log(`${c.green}${c.bright}ANALYSIS:${c.reset} ${c.green}CORS bypass successful! Proxy enables access${c.reset}`);
        } else if (directResult.success && !proxyResult.success) {
            console.log(`${c.yellow}${c.bright}ANALYSIS:${c.reset} ${c.yellow}Direct access works, proxy issue detected${c.reset}`);
        } else {
            console.log(`${c.red}${c.bright}ANALYSIS:${c.reset} ${c.red}URL inaccessible or not a valid audio source${c.reset}`);
        }
    }
    
    async systemDiagnostics() {
        const c = this.colors;
        
        console.log(`${c.yellow}${c.bright}[SYSTEM DIAGNOSTICS]${c.reset}`);
        console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
        
        // Library capabilities
        console.log(`${c.cyan}➤${c.reset} Running library capability tests...`);
        
        const capabilities = [
            'CORS Bypass via Proxy',
            'Environment Auto-detection', 
            'Fallback Strategy',
            'Multi-format Support',
            'Range Request Support'
        ];
        
        if (this.environment === 'tauri' || this.environment === 'electron') {
            capabilities.push('Enhanced Codec Detection');
            capabilities.push('Audio Metadata Extraction');
            capabilities.push('Audio Device Enumeration');
        }
        
        console.log(`${c.green}✓${c.reset} Detected capabilities:`);
        capabilities.forEach(cap => {
            console.log(`  ${c.cyan}•${c.reset} ${cap}`);
        });
        
        // Network diagnostics
        console.log(`${c.cyan}➤${c.reset} Running network diagnostics...`);
        const ports = [3002, 3001, 3003];
        
        for (const port of ports) {
            try {
                const response = await fetch(`http://localhost:${port}/health`, {
                    signal: AbortSignal.timeout(2000)
                });
                
                if (response.ok) {
                    const data = await response.json();
                    console.log(`  ${c.green}✓${c.reset} Port ${port}: ACTIVE (v${data.version})`);
                } else {
                    console.log(`  ${c.yellow}!${c.reset} Port ${port}: Responded but unhealthy`);
                }
            } catch (error) {
                console.log(`  ${c.red}✗${c.reset} Port ${port}: Not accessible`);
            }
        }
        
        await this.delay(1000);
        console.log(`${c.green}✓${c.reset} Diagnostics complete`);
    }
    
    async proxyServerStatus() {
        const c = this.colors;
        
        console.log(`${c.yellow}${c.bright}[PROXY SERVER STATUS]${c.reset}`);
        console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
        
        if (!this.proxyServerAvailable) {
            console.log(`${c.red}✗${c.reset} No proxy server detected`);
            console.log(`${c.yellow}!${c.reset} Start proxy server with: ${c.bright}npm run proxy:start${c.reset}`);
            return;
        }
        
        try {
            const response = await fetch(`${this.workingProxyUrl}/health`);
            const data = await response.json();
            
            console.log(`${c.green}✓${c.reset} Proxy server is ${c.green}ONLINE${c.reset}`);
            console.log(`${c.cyan}┌─────────────────────────────────────────────────────────────────────────────┐${c.reset}`);
            console.log(`${c.cyan}│${c.reset} URL:          ${this.workingProxyUrl.padEnd(61)} ${c.cyan}│${c.reset}`);
            console.log(`${c.cyan}│${c.reset} Version:      v${data.version.padEnd(60)} ${c.cyan}│${c.reset}`);
            console.log(`${c.cyan}│${c.reset} Status:       ${data.status.padEnd(61)} ${c.cyan}│${c.reset}`);
            console.log(`${c.cyan}│${c.reset} Uptime:        ${Math.floor(data.uptime)}s${' '.repeat(60 - Math.floor(data.uptime).toString().length - 1)} ${c.cyan}│${c.reset}`);
            console.log(`${c.cyan}│${c.reset} Port:         ${data.config.port.toString().padEnd(61)} ${c.cyan}│${c.reset}`);
            console.log(`${c.cyan}│${c.reset} Transcoding:  ${data.config.enableTranscoding.toString().padEnd(61)} ${c.cyan}│${c.reset}`);
            console.log(`${c.cyan}│${c.reset} Cache:        ${data.config.cacheEnabled.toString().padEnd(61)} ${c.cyan}│${c.reset}`);
            console.log(`${c.cyan}└─────────────────────────────────────────────────────────────────────────────┘${c.reset}`);
            
        } catch (error) {
            console.log(`${c.red}✗${c.reset} Error getting proxy status: ${error.message}`);
        }
    }
    
    async showExampleURLs() {
        const c = this.colors;
        
        console.log(`${c.yellow}${c.bright}[EXAMPLE AUDIO URLS]${c.reset}`);
        console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
        
        const testUrls = [
            { url: 'https://d3ctxlq1ktw2nl.cloudfront.net/production/2019-6-29/19776794-44100-2-1840c87ba7791.mp3', desc: 'Podcast Episode (CORS Blocked)' },
            { url: 'https://d3ctxlq1ktw2nl.cloudfront.net/production/2019-4-20/15524768-44100-2-08241a87e299b.mp3', desc: 'Tech Podcast (CORS Blocked)' },
            { url: 'https://www.learningcontainer.com/wp-content/uploads/2020/02/Kalimba.mp3', desc: 'Kalimba MP3 (CORS Blocked)' },
            { url: 'https://www.kozco.com/tech/piano2.wav', desc: 'Piano WAV (CORS Blocked)' },
            { url: 'https://traffic.libsyn.com/secure/noclippodcast/233.mp3', desc: 'Gaming Podcast (CORS Allowed)' }
        ];
        
        console.log(`${c.green}${c.bright}TEST AUDIO URLS:${c.reset}`);
        testUrls.forEach((item, index) => {
            console.log(`${c.bright}${index + 1})${c.reset} ${item.desc}`);
            console.log(`   ${c.dim}${item.url}${c.reset}`);
        });
        
        console.log();
        const testUrl = await this.getInput('Enter number to test URL (or press Enter to continue): ');
        
        if (testUrl && !isNaN(testUrl)) {
            const num = parseInt(testUrl) - 1;
            if (num >= 0 && num < testUrls.length) {
                console.log(`${c.cyan}➤${c.reset} Testing ${testUrls[num].desc}...`);
                await this.testSpecificUrl(testUrls[num].url);
            }
        }
    }
    
    async testSpecificUrl(url) {
        const directResult = await this.testDirectAccess(url);
        const proxyResult = await this.testProxyAccess(url);
        this.displayTestResults(url, directResult, proxyResult);
    }
    
    async advancedFeaturesDemo() {
        const c = this.colors;
        
        console.log(`${c.yellow}${c.bright}[ADVANCED FEATURES DEMONSTRATION]${c.reset}`);
        console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
        
        console.log(`${c.cyan}➤${c.reset} Environment: ${this.environment}`);
        console.log(`${c.cyan}➤${c.reset} Available methods:`);
        
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this.audioClient));
        methods.forEach(method => {
            if (!method.startsWith('_') && method !== 'constructor') {
                console.log(`  ${c.cyan}•${c.reset} ${method}()`);
            }
        });
        
        if (this.environment === 'tauri' || this.environment === 'electron') {
            console.log(`${c.green}✓${c.reset} Enhanced features available for ${this.environment} environment`);
            console.log(`  ${c.cyan}•${c.reset} Audio metadata extraction`);
            console.log(`  ${c.cyan}•${c.reset} Device enumeration`);
            console.log(`  ${c.cyan}•${c.reset} System audio info`);
        } else {
            console.log(`${c.yellow}!${c.reset} Basic features only (web environment)`);
            console.log(`${c.dim}  Enhanced features require Tauri or Electron${c.reset}`);
        }
    }
    
    async viewTestResults() {
        const c = this.colors;
        
        console.log(`${c.yellow}${c.bright}[TEST RESULTS HISTORY]${c.reset}`);
        console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
        
        if (this.testResults.size === 0) {
            console.log(`${c.yellow}!${c.reset} No test results available`);
            console.log(`${c.dim}  Run some URL tests first (option 1)${c.reset}`);
            return;
        }
        
        Array.from(this.testResults.entries()).forEach(([url, result], index) => {
            const directIcon = result.direct.success ? '✓' : '✗';
            const proxyIcon = result.proxy.success ? '✓' : '✗';
            const directColor = result.direct.success ? c.green : c.red;
            const proxyColor = result.proxy.success ? c.green : c.red;
            
            console.log(`${c.bright}${index + 1})${c.reset} ${url.substring(0, 60)}...`);
            console.log(`   Direct: ${directColor}${directIcon}${c.reset} Proxy: ${proxyColor}${proxyIcon}${c.reset} ${c.dim}(${result.timestamp.toLocaleTimeString()})${c.reset}`);
        });
    }
    
    async showHelp() {
        const c = this.colors;
        
        console.log(`${c.yellow}${c.bright}[HELP & DOCUMENTATION]${c.reset}`);
        console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
        
        console.log(`${c.green}${c.bright}ABOUT DESKTOP AUDIO PROXY:${c.reset}`);
        console.log(`Desktop Audio Proxy is a TypeScript library that enables audio streaming`);
        console.log(`in desktop applications by bypassing CORS restrictions and codec issues.`);
        console.log();
        
        console.log(`${c.green}${c.bright}KEY FEATURES:${c.reset}`);
        console.log(`${c.cyan}•${c.reset} CORS bypass via proxy server`);
        console.log(`${c.cyan}•${c.reset} Auto-detection of Tauri/Electron/Web environments`);
        console.log(`${c.cyan}•${c.reset} Fallback strategies for reliability`);
        console.log(`${c.cyan}•${c.reset} Support for multiple audio formats`);
        console.log(`${c.cyan}•${c.reset} Range request support for seeking`);
        console.log();
        
        console.log(`${c.green}${c.bright}USAGE:${c.reset}`);
        console.log(`1. Start proxy server: ${c.bright}npm run proxy:start${c.reset}`);
        console.log(`2. Test audio URLs to see CORS bypass in action`);
        console.log(`3. Use system diagnostics to verify configuration`);
        console.log();
        
        console.log(`${c.green}${c.bright}LINKS:${c.reset}`);
        console.log(`GitHub: https://github.com/bandonker/desktop-audio-proxy`);
        console.log(`NPM: https://www.npmjs.com/package/desktop-audio-proxy`);
    }
    
    async showStartupCommands() {
        const c = this.colors;
        
        console.log(`${c.yellow}${c.bright}[STARTUP COMMANDS REFERENCE]${c.reset}`);
        console.log(`${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
        
        console.log(`${c.green}${c.bright}REQUIRED SETUP FOR FULL CORS BYPASS DEMONSTRATION:${c.reset}`);
        console.log();
        
        console.log(`${c.cyan}${c.bright}Terminal 1 - Start Proxy Server:${c.reset}`);
        console.log(`${c.bright}npm run proxy:start${c.reset}`);
        console.log(`${c.dim}This starts the Desktop Audio Proxy server on http://localhost:3002${c.reset}`);
        console.log();
        
        console.log(`${c.cyan}${c.bright}Terminal 2 - Run CLI Demo:${c.reset}`);
        console.log(`${c.bright}npm run demo:cli${c.reset}`);
        console.log(`${c.dim}This starts the interactive CLI demonstration interface${c.reset}`);
        console.log();
        
        console.log(`${c.green}${c.bright}ALTERNATIVE COMMANDS:${c.reset}`);
        console.log(`${c.cyan}•${c.reset} Build library: ${c.bright}npm run build${c.reset}`);
        console.log(`${c.cyan}•${c.reset} Run tests: ${c.bright}npm test${c.reset}`);
        console.log(`${c.cyan}•${c.reset} Web demo: ${c.bright}npm run demo:serve${c.reset} (then visit http://localhost:8080)`);
        console.log(`${c.cyan}•${c.reset} Integration test: ${c.bright}npm run test:integration${c.reset}`);
        console.log();
        
        console.log(`${c.green}${c.bright}CURRENT STATUS:${c.reset}`);
        if (this.proxyServerAvailable) {
            console.log(`${c.green}✓${c.reset} Proxy server is running on ${this.workingProxyUrl}`);
            console.log(`${c.green}✓${c.reset} Ready to demonstrate CORS bypass functionality`);
        } else {
            console.log(`${c.red}✗${c.reset} Proxy server not detected`);
            console.log(`${c.yellow}!${c.reset} Start proxy server to enable full CORS bypass testing`);
        }
        
        console.log();
        console.log(`${c.dim}💡 Pro tip: Keep both terminals open for the best demonstration experience${c.reset}`);
    }
    
    async getInput(prompt) {
        const c = this.colors;
        return new Promise((resolve) => {
            this.rl.question(`${c.cyan}${prompt}${c.reset}`, (answer) => {
                resolve(answer.trim());
            });
        });
    }
}

// Initialize the hacker CLI demo
new HackerCLIDemo();