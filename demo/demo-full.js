// Desktop Audio Proxy Live Demo - Full Implementation
// This demo uses the actual built library to show real functionality

import { createAudioClient } from '../dist/browser.esm.js';

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}

class DesktopAudioProxyDemo {
    constructor() {
        this.audioClient = null;
        this.proxyServerAvailable = false;
        this.environment = null;
        this.debugMode = true;
        this.testResults = new Map();
        
        this.init();
    }
    
    async init() {
        console.log('🎵 Desktop Audio Proxy Demo Starting (Full Implementation)...');
        
        try {
            // Initialize the actual library
            await this.initializeLibrary();
            
            // Check system status
            await this.checkSystemStatus();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Expose methods for inspection
            this.exposeInternals();
            
            console.log('✅ Demo fully initialized with real library');
            
        } catch (error) {
            console.error('❌ Failed to initialize demo:', error);
            this.showError('Failed to load Desktop Audio Proxy library', error);
        }
    }
    
    async initializeLibrary() {
        console.log('📦 Initializing Desktop Audio Proxy library...');
        
        // Auto-detect available package builds
        const possibleBuilds = [
            '../dist/browser.esm.js',    // Built from source
            '../dist/browser.cjs',       // CommonJS build
            './browser.esm.js',          // Copied to demo directory
            'https://unpkg.com/desktop-audio-proxy@latest/dist/browser.esm.js'  // CDN fallback
        ];
        
        let audioClientImport = null;
        for (const buildPath of possibleBuilds) {
            try {
                console.log(`🔍 Trying to import from: ${buildPath}`);
                const module = await import(buildPath);
                if (module.createAudioClient) {
                    audioClientImport = module.createAudioClient;
                    console.log(`✅ Successfully imported from: ${buildPath}`);
                    break;
                }
            } catch (error) {
                console.log(`❌ Failed to import from ${buildPath}:`, error.message);
            }
        }
        
        if (!audioClientImport) {
            throw new Error('Could not import Desktop Audio Proxy library from any location');
        }
        
        // Try different proxy ports (in case of conflicts)
        const possiblePorts = [3002, 3001, 3003]; // Try 3002 first since that's the default
        let proxyUrl = 'http://localhost:3002';
        
        // Check which port is actually available
        for (const port of possiblePorts) {
            try {
                const testUrl = `http://localhost:${port}/health`;
                const response = await fetch(testUrl, { 
                    method: 'GET',
                    headers: { 'Accept': 'application/json' }
                }).catch(() => null);
                
                if (response && response.ok) {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const data = await response.json();
                        proxyUrl = `http://localhost:${port}`;
                        console.log(`✅ Found proxy server on port ${port}:`, data);
                        break;
                    }
                }
            } catch (error) {
                console.log(`❌ Port ${port} not available:`, error.message);
            }
        }
        
        // Create the actual audio client with real configuration
        this.audioClient = audioClientImport({
            proxyUrl,
            autoDetect: true,
            fallbackToOriginal: true,
            retryAttempts: 3,
            retryDelay: 1000,
            
            // Proxy server configuration
            proxyServerConfig: {
                corsOrigins: '*',
                timeout: 60000,
                maxRedirects: 20,
                enableLogging: this.debugMode,
                userAgent: 'DesktopAudioProxy-Demo/1.1.0'
            }
        });
        
        // Check proxy availability first (needed for version detection)
        await this.checkInitialProxyStatus();
        
        // Auto-detect library version and features
        const versionInfo = await this.detectLibraryVersion();
        console.log('Library Info:', versionInfo);
        
        // Log the actual client object for inspection
        console.log('Audio Client Instance:', this.audioClient);
        console.log('Available Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.audioClient)));
    }
    
    async checkInitialProxyStatus() {
        console.log(' Initial proxy status check...');
        
        // Try different proxy ports to find which one is available
        const possiblePorts = [3002, 3001, 3003];
        this.proxyServerAvailable = false;
        this.workingProxyUrl = null;
        
        for (const port of possiblePorts) {
            try {
                const testUrl = `http://localhost:${port}/health`;
                const response = await fetch(testUrl, { 
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(3000) // 3 second timeout
                }).catch(() => null);
                
                if (response && response.ok) {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const data = await response.json();
                        this.workingProxyUrl = `http://localhost:${port}`;
                        this.proxyServerAvailable = true;
                        console.log(`✅ Found working proxy on port ${port}:`, data);
                        break;
                    }
                }
            } catch (error) {
                console.log(`❌ Port ${port} not available for initial check`);
            }
        }
        
        console.log(`Initial proxy status: ${this.proxyServerAvailable ? 'Available' : 'Not Available'}`);
    }
    
    async detectLibraryVersion() {
        try {
            let versionInfo = { version: 'unknown', features: [] };
            
            // Method 1: Try to get version from proxy server health endpoint (most reliable)
            // Check if proxy is available first, don't rely on this.proxyServerAvailable
            const possiblePorts = [3002, 3001, 3003];
            for (const port of possiblePorts) {
                try {
                    const proxyUrl = `http://localhost:${port}`;
                    const response = await fetch(`${proxyUrl}/health`, { 
                        method: 'GET',
                        headers: { 'Accept': 'application/json' }
                    });
                    if (response.ok) {
                        const healthData = await response.json();
                        if (healthData.version) {
                            versionInfo.version = healthData.version;
                            console.log(`✅ Version detected from proxy server on port ${port}: v${healthData.version}`);
                            break;
                        }
                    }
                } catch (error) {
                    console.log(`Could not get version from proxy server on port ${port}`);
                }
            }
            
            // Method 2: Try to detect from package.json files (fallback)
            if (versionInfo.version === 'unknown') {
                const packageJsonPaths = [
                    '../package.json',
                    './package.json',
                    'https://unpkg.com/desktop-audio-proxy@latest/package.json'
                ];
                
                const detectedVersions = [];
                
                for (const path of packageJsonPaths) {
                    try {
                        let packageData;
                        if (path.startsWith('http')) {
                            const response = await fetch(path);
                            if (response.ok) {
                                packageData = await response.json();
                            }
                        } else {
                            // For local files, try fetch (might work in some environments)
                            const response = await fetch(path).catch(() => null);
                            if (response && response.ok) {
                                packageData = await response.json();
                            }
                        }
                        
                        if (packageData && packageData.version) {
                            detectedVersions.push({
                                version: packageData.version,
                                source: path
                            });
                            console.log(`✅ Version detected from ${path}: v${packageData.version}`);
                        }
                    } catch (error) {
                        console.log(`Could not load package info from ${path}`);
                    }
                }
                
                // Handle multiple versions
                if (detectedVersions.length > 0) {
                    // Use the first local version found, or latest if only remote
                    const localVersion = detectedVersions.find(v => !v.source.startsWith('http'));
                    if (localVersion) {
                        versionInfo.version = localVersion.version;
                        versionInfo.installedVersions = detectedVersions;
                    } else {
                        versionInfo.version = detectedVersions[0].version;
                        versionInfo.installedVersions = detectedVersions;
                    }
                    
                    // Warn about multiple versions
                    if (detectedVersions.length > 1) {
                        const versions = detectedVersions.map(v => `v${v.version} (${v.source})`).join(', ');
                        console.warn(`⚠️ Multiple versions detected: ${versions}`);
                        versionInfo.multipleVersionsWarning = `Multiple versions found: ${versions}`;
                    }
                }
            }
            
            // Method 3: Try to infer from library capabilities (last resort)
            if (versionInfo.version === 'unknown') {
                // Check if we have v1.1.0+ features available
                if (this.audioClient && typeof this.audioClient.getEnvironment === 'function') {
                    versionInfo.version = '1.1.0+'; // Has modern features
                    console.log('⚠️ Version inferred from available features: v1.1.0+');
                } else {
                    versionInfo.version = '1.0.x'; // Basic functionality only
                    console.log('⚠️ Version inferred from available features: v1.0.x');
                }
            }
            
            // Feature detection based on available methods
            const availableFeatures = [];
            
            // v1.1.0 features are available through service classes, not client directly
            // Client provides basic proxy functionality
            availableFeatures.push('CORS Bypass via Proxy');
            availableFeatures.push('Environment Auto-detection');
            availableFeatures.push('Fallback Strategy');
            availableFeatures.push('Multi-format Support');
            
            // Advanced features available through service classes (not exposed in demo)
            if (this.environment === 'tauri' || this.environment === 'electron') {
                availableFeatures.push('Enhanced Codec Detection (via Service)');
                availableFeatures.push('Audio Metadata Extraction (via Service)');
                availableFeatures.push('Audio Device Enumeration (via Service)');
            }
            
            versionInfo.features = availableFeatures;
            versionInfo.isEnhanced = availableFeatures.length > 0;
            
            // Version comparison and upgrade recommendations
            const currentVersion = versionInfo.version;
            versionInfo.upgradeRecommendation = this.getUpgradeRecommendation(currentVersion, availableFeatures);
            
            // Update UI with version info
            this.displayVersionInfo(versionInfo);
            
            // Update the library version in status panel with real detected version
            this.updateLibraryVersionUI(versionInfo);
            
            return versionInfo;
        } catch (error) {
            console.error('Error detecting library version:', error);
            return { version: 'unknown', features: [], error: error.message };
        }
    }
    
    getUpgradeRecommendation(version, features) {
        if (version === 'unknown') {
            return { 
                needed: true, 
                message: 'Version detection failed. Consider updating to latest version for best experience.' 
            };
        }
        
        const majorVersion = parseInt(version.split('.')[0]);
        const minorVersion = parseInt(version.split('.')[1] || '0');
        
        if (majorVersion < 1 || (majorVersion === 1 && minorVersion < 1)) {
            return {
                needed: true,
                message: `You're using v${version}. Upgrade to v1.1.0+ for enhanced codec detection, metadata extraction, and device enumeration.`,
                newFeatures: [
                    'Enhanced codec detection with real-time format testing',
                    'Audio metadata extraction (duration, format, bitrate)',
                    'Audio device enumeration for better audio routing',
                    'Improved Tauri and Electron integration'
                ]
            };
        }
        
        if (features.length === 0) {
            return {
                needed: true,
                message: `Version ${version} detected but enhanced features not available. Ensure you're using the latest build.`
            };
        }
        
        return {
            needed: false,
            message: `Using v${version} with all enhanced features available.`
        };
    }
    
    updateLibraryVersionUI(versionInfo) {
        const libVersionElement = document.getElementById('library-version');
        if (libVersionElement) {
            libVersionElement.textContent = versionInfo.version || 'unknown';
            
            // Add warning styling if multiple versions detected
            if (versionInfo.multipleVersionsWarning) {
                libVersionElement.style.color = '#c1666b';
                libVersionElement.title = versionInfo.multipleVersionsWarning;
            } else if (versionInfo.version && versionInfo.version !== 'unknown') {
                libVersionElement.style.color = '#a8a8a8';
                libVersionElement.title = `Version detected: ${versionInfo.version}`;
            } else {
                libVersionElement.style.color = '#c1666b';
                libVersionElement.title = 'Version could not be detected';
            }
        }
    }

    displayVersionInfo(versionInfo) {
        // Add version info to the UI
        const environmentElement = document.getElementById('environment');
        if (environmentElement && environmentElement.parentNode) {
            const safeVersion = escapeHtml(versionInfo.version || 'unknown');
            const safeFeatures = versionInfo.features.map(feature => escapeHtml(feature));
            const safeMultipleVersionsWarning = versionInfo.multipleVersionsWarning
                ? escapeHtml(versionInfo.multipleVersionsWarning)
                : '';
            const safeUpgradeMessage = escapeHtml(versionInfo.upgradeRecommendation.message);
            const versionElement = document.createElement('div');
            versionElement.innerHTML = `
                <strong>Library Version:</strong> ${safeVersion}<br>
                <strong>Enhanced Features:</strong> ${versionInfo.isEnhanced ? 'Available' : 'Not Available'}<br>
                ${safeFeatures.length > 0 ? 
                    `<strong>Active Features:</strong> ${safeFeatures.join(', ')}<br>` : ''
                }
                ${safeMultipleVersionsWarning ? 
                    `<div style="color: #c1666b; margin-top: 5px;"><strong>⚠️ ${safeMultipleVersionsWarning}</strong></div>` : ''
                }
                ${versionInfo.upgradeRecommendation.needed ? 
                    `<div style="color: #c1666b; margin-top: 5px;"><strong>⚠️ ${safeUpgradeMessage}</strong></div>` :
                    `<div style="color: #a8a8a8; margin-top: 5px;"><strong>✅ ${safeUpgradeMessage}</strong></div>`
                }
            `;
            versionElement.style.fontSize = '12px';
            versionElement.style.marginTop = '10px';
            versionElement.style.padding = '10px';
            versionElement.style.border = '1px solid #4a4a4a';
            versionElement.style.borderRadius = '4px';
            versionElement.style.backgroundColor = '#2a2a2a';
            versionElement.style.color = '#a8a8a8';
            
            environmentElement.parentNode.appendChild(versionElement);
        }
    }
    
    async checkSystemStatus() {
        console.log('Checking system status with real library...');
        
        // Get actual environment detection
        this.environment = this.audioClient.getEnvironment();
        const environmentDisplay = this.environment === 'web' ? 'Web Browser' :
                                  this.environment === 'tauri' ? 'Tauri App' :
                                  this.environment === 'electron' ? 'Electron App' :
                                  'Unknown';
        document.getElementById('environment').textContent = environmentDisplay;
        
        console.log('Detected Environment:', this.environment);
        
        // Update proxy status UI based on initial check
        this.updateProxyStatusUI();
        
        // If no proxy was found initially, try to find one
        if (!this.proxyServerAvailable) {
            console.log('No proxy found initially, trying to find working proxy...');
            await this.findWorkingProxy();
        }
    }
    
    updateProxyStatusUI() {
        const proxyElement = document.getElementById('proxy-status');
        
        if (this.proxyServerAvailable && this.workingProxyUrl) {
            const port = this.workingProxyUrl.split(':')[2];
            proxyElement.textContent = port === '3002' ? '✅ Available' : `✅ Available (Port ${port})`;
            proxyElement.style.color = '#a8a8a8';
            proxyElement.title = `Proxy server running on ${this.workingProxyUrl}`;
            console.log('✅ Proxy server is available at:', this.workingProxyUrl);
        } else {
            proxyElement.textContent = '❌ Not Available';
            proxyElement.style.color = '#c1666b';
            proxyElement.title = 'No proxy server found. Start with: npm run proxy:start';
            console.log('❌ Proxy server not available');
        }
    }
    
    async findWorkingProxy() {
        console.log('Searching for working proxy server...');
        
        const possiblePorts = [3002, 3001, 3003];
        for (const port of possiblePorts) {
            try {
                const testUrl = `http://localhost:${port}/health`;
                console.log(`Testing proxy on port ${port}...`);
                
                const response = await fetch(testUrl, { 
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(3000) // 3 second timeout
                });
                
                if (response.ok) {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const data = await response.json();
                        console.log(`✅ Found working proxy on port ${port}:`, data);
                        
                        // Update the audio client with the working URL
                        this.workingProxyUrl = `http://localhost:${port}`;
                        this.audioClient.options.proxyUrl = this.workingProxyUrl;
                        this.proxyServerAvailable = true;
                        
                        // Update UI using the centralized method
                        this.updateProxyStatusUI();
                        
                        return true;
                    }
                }
            } catch (error) {
                console.log(`❌ Port ${port} not available:`, error.message);
            }
        }
        
        console.log('❌ No working proxy server found');
        this.proxyServerAvailable = false;
        this.workingProxyUrl = null;
        this.updateProxyStatusUI();
        return false;
    }

    async getProxyInfo() {
        // Try to get proxy server information
        const proxyUrl = this.workingProxyUrl || this.audioClient.options.proxyUrl;
        const response = await fetch(`${proxyUrl}/health`, {
            headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
            return await response.json();
        }
        throw new Error('Proxy info not available');
    }
    
    setupEventListeners() {
        // Set up real event listeners
        const testButton = document.getElementById('test-btn');
        const urlInput = document.getElementById('audio-url');
        
        testButton.addEventListener('click', () => this.testAudioUrl());
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.testAudioUrl();
            }
        });
        
        // Add preset URL buttons
        document.querySelectorAll('.preset-buttons button').forEach(button => {
            button.addEventListener('click', (e) => {
                const url = e.target.getAttribute('data-url');
                if (url) {
                    this.setUrl(url);
                }
            });
        });
    }
    
    exposeInternals() {
        // Expose everything for inspection in dev tools
        window.dapDemo = {
            instance: this,
            audioClient: this.audioClient,
            environment: this.environment,
            proxyAvailable: this.proxyServerAvailable,
            testResults: this.testResults,
            
            // Methods for manual testing
            testUrl: (url) => this.testSingleUrl(url),
            getPlayableUrl: (url) => this.audioClient.getPlayableUrl(url),
            checkCanPlay: (url) => this.audioClient.canPlayUrl ? this.audioClient.canPlayUrl(url) : 'Method not available',
            getEnvironment: () => this.audioClient.getEnvironment(),
            isProxyAvailable: () => this.audioClient.isProxyAvailable(),
            
            // Debug helpers
            enableDebug: () => this.enableDebugMode(),
            getInternalState: () => this.getInternalState(),
            clearTestResults: () => this.testResults.clear(),
            
            // v1.1.0 features showcase (through service classes)
            createTauriService: () => {
                const { TauriAudioService } = window.dapDemo.modules || {};
                if (!TauriAudioService) return 'TauriAudioService not loaded in browser build';
                return new TauriAudioService({ proxyUrl: this.audioClient.options.proxyUrl });
            },
            createElectronService: () => {
                const { ElectronAudioService } = window.dapDemo.modules || {};
                if (!ElectronAudioService) return 'ElectronAudioService not loaded in browser build';
                return new ElectronAudioService({ proxyUrl: this.audioClient.options.proxyUrl });
            },
            showV11Features: () => {
                console.log('v1.1.0 Enhanced Features:');
                console.log('• Enhanced codec detection via TauriAudioService/ElectronAudioService');
                console.log('• Audio metadata extraction via service.getAudioMetadata()');
                console.log('• Audio device enumeration via service.getAudioDevices()');
                console.log('• Improved environment detection and fallback strategies');
                console.log('Note: Advanced features require service classes, not the basic client');
                return 'Check console for feature details';
            }
        };
        
        console.log('Demo internals exposed as window.dapDemo');
        console.log('Try: window.dapDemo.testUrl("https://example.com/audio.mp3")');
        console.log('v1.1.0 Features: window.dapDemo.showV11Features(), createTauriService(), createElectronService()');
    }
    
    enableDebugMode() {
        this.debugMode = true;
        if (this.audioClient && this.audioClient.enableDebug) {
            this.audioClient.enableDebug();
        }
        console.log('🐛 Debug mode enabled');
    }
    
    getInternalState() {
        return {
            audioClient: this.audioClient,
            environment: this.environment,
            proxyAvailable: this.proxyServerAvailable,
            testResults: Array.from(this.testResults.entries()),
            debugMode: this.debugMode
        };
    }
    
    setUrl(url) {
        document.getElementById('audio-url').value = url;
    }
    
    async testAudioUrl() {
        const url = document.getElementById('audio-url').value.trim();
        
        if (!url) {
            alert('Please enter an audio URL to test');
            return;
        }
        
        console.log(`Testing URL with real library: ${url}`);
        
        // Reset UI
        this.resetTestResults();
        
        // Test direct URL (without proxy)
        await this.testDirectUrl(url);
        
        // Test with real proxy
        await this.testProxyUrl(url);
        
        // Store test results
        this.testResults.set(url, {
            timestamp: new Date(),
            directResult: this.getTestResult('direct'),
            proxyResult: this.getTestResult('proxy'),
            environment: this.environment,
            proxyAvailable: this.proxyServerAvailable
        });
        
        console.log('Test Results Stored:', this.testResults.get(url));
    }
    
    getTestResult(type) {
        const statusElement = document.getElementById(`${type === 'direct' ? 'direct' : 'proxy-test'}-status`);
        return {
            status: statusElement.textContent,
            success: statusElement.classList.contains('success')
        };
    }
    
    resetTestResults() {
        // Reset direct test
        const directStatus = document.getElementById('direct-status');
        const directError = document.getElementById('direct-error');
        const directDetails = document.getElementById('direct-details');
        const directPlayer = document.getElementById('direct-player');
        
        directStatus.textContent = '⏳ Testing...';
        directStatus.className = 'status-indicator loading';
        directError.textContent = '';
        directDetails.textContent = '';
        directPlayer.src = '';
        directPlayer.closest('.test-result').classList.remove('success', 'error');
        
        // Reset proxy test
        const proxyStatus = document.getElementById('proxy-test-status');
        const proxySuccess = document.getElementById('proxy-success');
        const proxyDetails = document.getElementById('proxy-details');
        const proxyPlayer = document.getElementById('proxy-player');
        
        proxyStatus.textContent = '⏳ Testing...';
        proxyStatus.className = 'status-indicator loading';
        proxySuccess.textContent = '';
        proxyDetails.textContent = '';
        proxyPlayer.src = '';
        proxyPlayer.closest('.test-result').classList.remove('success', 'error');
    }
    
    async testDirectUrl(url) {
        const statusElement = document.getElementById('direct-status');
        const errorElement = document.getElementById('direct-error');
        const detailsElement = document.getElementById('direct-details');
        const playerElement = document.getElementById('direct-player');
        const resultContainer = statusElement.closest('.test-result');
        
        try {
            console.log('Testing direct URL access (no proxy)...');
            console.log('IMPORTANT: This test uses the ORIGINAL URL directly (no proxy server)');
            console.log(`Testing URL: ${url}`);
            
            // Use fetch() to test CORS - this strictly enforces CORS policy
            detailsElement.textContent = 'Testing CORS policy with fetch()...';
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, 5000);
            
            // Use a custom header to force a preflight request, which will fail without CORS
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest', // Forces preflight
                    'Accept': 'audio/*'
                },
                mode: 'cors', // Explicitly require CORS
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // If we get here without an error, CORS is allowed
            if (response.ok || response.status === 206) {
                // Success - CORS headers are present
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // If we get here, it worked
            statusElement.textContent = '✅ Success (No CORS restriction)';
            statusElement.className = 'status-indicator success';
            resultContainer.classList.add('success');
            
            playerElement.src = url;
            const safeUrl = escapeHtml(url);
            detailsElement.innerHTML = `
                <strong>✅ Unexpected Success:</strong> This URL allows cross-origin access<br>
                <strong>Original URL:</strong> <code>${safeUrl}</code><br>
                <strong>Result:</strong> Server has CORS headers or allows cross-origin access<br>
                <strong>Note:</strong> This URL might not need the proxy, but most audio URLs do
            `;
            
            console.log('✅ Direct URL test passed');
            
        } catch (error) {
            console.error('❌ Direct URL test failed:', error);
            
            statusElement.textContent = '❌ Failed (CORS Blocked)';
            statusElement.className = 'status-indicator error';
            resultContainer.classList.add('error');
            
            // Determine the type of error for better user feedback
            let errorType = 'Network/CORS Error';
            let errorExplanation = 'Server lacks CORS headers - browser blocks cross-origin access';
            
            const errorMessage = getErrorMessage(error);
            if (errorMessage.includes('CORS') || errorMessage.includes('cors')) {
                errorType = 'CORS Policy Violation';
                errorExplanation = 'Server does not allow cross-origin requests from browsers';
            } else if (errorMessage.includes('timeout') || errorMessage.includes('abort')) {
                errorType = 'Request Timeout/Blocked';
                errorExplanation = 'Server may be blocking cross-origin requests or responding slowly';
            } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
                errorType = 'CORS Preflight Failed';
                errorExplanation = 'Server rejected the CORS preflight request (OPTIONS method)';
            }
            
            errorElement.textContent = `${errorType} - This demonstrates why the proxy is needed!`;
            const safeErrorType = escapeHtml(errorType);
            const safeErrorMessage = escapeHtml(errorMessage);
            const safeUrl = escapeHtml(url);
            const safeErrorExplanation = escapeHtml(errorExplanation);
            detailsElement.innerHTML = `
                <strong>❌ CORS Blocked (Expected):</strong> ${safeErrorType}<br>
                <strong>Error Details:</strong> ${safeErrorMessage}<br>
                <strong>Original URL:</strong> <code>${safeUrl}</code><br>
                <strong>Why this failed:</strong> ${safeErrorExplanation}<br>
                <strong>Solution:</strong> Use the proxy test below to see CORS bypass in action<br>
                <strong>This demonstrates:</strong> Why Desktop Audio Proxy is needed for most audio URLs
            `;
            
            // Don't set player source since it failed
            playerElement.src = '';
        }
    }
    
    async testProxyUrl(url) {
        const statusElement = document.getElementById('proxy-test-status');
        const successElement = document.getElementById('proxy-success');
        const detailsElement = document.getElementById('proxy-details');
        const playerElement = document.getElementById('proxy-player');
        const resultContainer = statusElement.closest('.test-result');
        
        try {
            console.log('Testing with real Desktop Audio Proxy...');
            console.log('IMPORTANT: This test uses the PROXY SERVER to bypass CORS');
            console.log(`Original URL: ${url}`);
            
            if (!this.proxyServerAvailable) {
                throw new Error('Proxy server is not available. Start with: npm run proxy:start');
            }
            
            // Use the real library to get a playable URL
            console.log('Calling audioClient.getPlayableUrl()...');
            const playableUrl = await this.audioClient.getPlayableUrl(url);
            
            console.log(`Original URL: ${url}`);
            console.log(`Proxied URL: ${playableUrl}`);
            console.log('The proxied URL should work even if the direct URL failed!');
            
            // Test if the proxied URL actually works
            const testAudio = new Audio();
            
            const loadPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Proxied URL did not load within 10 seconds'));
                }, 10000);
                
                testAudio.addEventListener('canplay', () => {
                    clearTimeout(timeout);
                    resolve(true);
                });
                
                testAudio.addEventListener('error', (e) => {
                    clearTimeout(timeout);
                    reject(new Error(`Proxied audio load error: ${e.message || 'Unknown error'}`));
                });
                
                testAudio.addEventListener('loadstart', () => {
                    detailsElement.textContent = 'Loading proxied URL...';
                });
            });
            
            // Set the proxied URL
            testAudio.src = playableUrl;
            
            // Wait for result
            await loadPromise;
            
            // Success!
            statusElement.textContent = '✅ Success (CORS Bypassed)';
            statusElement.className = 'status-indicator success';
            resultContainer.classList.add('success');
            
            successElement.textContent = 'CORS bypass successful via proxy server!';
            const safePlayableUrl = escapeHtml(playableUrl);
            const safeEnvironment = escapeHtml(this.environment ?? 'unknown');
            const safeWorkingProxyUrl = escapeHtml(this.workingProxyUrl ?? 'unknown');
            const safeRetryAttempts = escapeHtml(this.audioClient.options.retryAttempts);
            const safeFallback = escapeHtml(this.audioClient.options.fallbackToOriginal);
            detailsElement.innerHTML = `
                <strong>Library Method Used:</strong> <code>audioClient.getPlayableUrl()</code><br>
                <strong>Proxied URL:</strong><br>
                <code style="word-break: break-all; font-size: 11px;">${safePlayableUrl}</code><br><br>
                <strong>Process:</strong> Original URL → Proxy Server → Browser (CORS bypassed)<br>
                <strong>Library Features Active:</strong><br>
                • Environment Detection: ${safeEnvironment}<br>
                • Proxy Server: ${safeWorkingProxyUrl}<br>
                • Auto Retry: ${safeRetryAttempts} attempts<br>
                • Fallback Enabled: ${safeFallback}
            `;
            
            // Set the working proxied URL
            playerElement.src = playableUrl;
            
            console.log('✅ Proxy URL test passed');
            
        } catch (error) {
            console.error('❌ Proxy URL test failed:', error);
            
            statusElement.textContent = '❌ Failed';
            statusElement.className = 'status-indicator error';
            resultContainer.classList.add('error');
            
            // Check if it's a non-audio content type issue
            const errorMessage = getErrorMessage(error);
            const isNonAudioContent = errorMessage.includes('text/html') || 
                                     url.includes('youtube.com') || 
                                     url.includes('spotify.com') || 
                                     url.includes('soundcloud.com');
            
            if (isNonAudioContent) {
                detailsElement.innerHTML = `
                    <strong>Error:</strong> Not a direct audio file URL<br><br>
                    <strong>Issue:</strong> This URL returns HTML/webpage content, not audio<br><br>
                    <strong>Library Limitation:</strong><br>
                    Desktop Audio Proxy can only handle direct audio file URLs (MP3, WAV, etc.)<br>
                    It cannot extract audio from video platforms or streaming services.<br><br>
                    <strong>Solution:</strong> Use direct audio file URLs only
                `;
            } else if (!this.proxyServerAvailable) {
                const safeErrorMessage = escapeHtml(errorMessage);
                const safePort = escapeHtml(this.workingProxyUrl?.split(':')[2] || '3002');
                detailsElement.innerHTML = `
                    <strong>Error:</strong> ${safeErrorMessage}<br><br>
                    <strong>Issue:</strong> Proxy server is not available<br><br>
                    <strong>Solution:</strong><br>
                    • Start proxy server: <code>npm run proxy:start</code><br>
                    • Check that port ${safePort} is not blocked<br>
                    • Restart the demo
                `;
            } else {
                const safeErrorMessage = escapeHtml(errorMessage);
                const safeRetryAttempts = escapeHtml(this.audioClient.options.retryAttempts);
                detailsElement.innerHTML = `
                    <strong>Error:</strong> ${safeErrorMessage}<br><br>
                    <strong>Possible Issues:</strong><br>
                    • URL might be inaccessible or return 404<br>
                    • Server might not allow proxying<br>
                    • Audio format might not be supported<br><br>
                    <strong>Library attempted:</strong> ${safeRetryAttempts} retries with proxy
                `;
            }
        }
    }
    
    async testSingleUrl(url) {
        // Helper method for manual testing via console
        try {
            const result = await this.audioClient.getPlayableUrl(url);
            console.log(`✅ ${url} → ${result}`);
            return result;
        } catch (error) {
            console.error(`❌ ${url} → Error: ${error.message}`);
            throw error;
        }
    }
    
    showError(message, error = null) {
        const statusPanel = document.querySelector('.status-panel');
        const safeMessage = escapeHtml(message);
        const safeErrorMessage = error ? escapeHtml(getErrorMessage(error)) : '';
        statusPanel.innerHTML = `
            <h3>❌ Error</h3>
            <div class="error-message">${safeMessage}</div>
            ${error ? `<div class="error-details">${safeErrorMessage}</div>` : ''}
        `;
        
        console.error('Demo Error:', message, error);
    }
}

// Tab switching for code examples
function showTab(tabName, event) {
    document.querySelectorAll('.code-content').forEach(content => {
        content.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(`${tabName}-code`).classList.add('active');
    event.target.classList.add('active');
}

// Initialize demo when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.demoInstance = new DesktopAudioProxyDemo();
});

// Export functions for global access (for onclick handlers)
window.showTab = showTab;
window.testAudioUrl = () => {
    if (window.demoInstance) {
        window.demoInstance.testAudioUrl();
    } else {
        console.error('Demo not yet initialized');
    }
};

// Helper function for preset buttons
window.setUrl = (url) => {
    if (window.demoInstance) {
        window.demoInstance.setUrl(url);
    } else {
        document.getElementById('audio-url').value = url;
    }
};
