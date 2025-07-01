# Desktop Audio Proxy Demos

This directory contains comprehensive demonstrations of the Desktop Audio Proxy library, showcasing both web-based and CLI interfaces.

##  Interactive Web Demo

**File:** `index.html` + `demo-full.js`

A comprehensive web-based demonstration featuring:

###  Features
- **Auto-Detection** - Automatically finds and loads available library builds
- **Dynamic Version Detection** - Shows current library version from proxy server or package.json
- **Enhanced Features Showcase** - Live codec detection, metadata extraction, device enumeration
- **Real-time CORS Testing** - Compare direct URL vs proxy with live audio playback
- **Developer Tools** - Exposed internals for manual testing (`window.dapDemo`)
- **Smart Fallbacks** - Works with any version of the library
- **Visual Upgrade Guidance** - Clear recommendations for older versions

###  How to Run
```bash
# Option 1: Simple HTTP server
npm run demo:serve

# Option 2: Full setup with proxy
npm run demo:simple

# Option 3: Open directly in browser
open demo/index.html
```

### What You Can Test
- **Any audio URL** - Paste podcast, radio, or music URLs
- **Environment detection** - See if you're in Tauri, Electron, or web
- **Codec capabilities** - Test what formats your system supports  
- **Metadata extraction** - View audio file information
- **Device enumeration** - List available audio devices
- **Version detection** - See multiple version handling

---

## CLI Demo

**File:** `cli-demo.js`

A terminal-based interface with professional ASCII art and effects:

###  Features
- **Professional ASCII Art** - Clean "DAP" banner with terminal effects
- **Real-time System Status** - Live proxy detection and version info
- **Audio URL Testing** - Compare direct vs proxy access with detailed analysis
- **System Diagnostics** - Network scanning, capability testing, version detection
- **Test Results History** - Track all your URL tests with timestamps
- **Proxy Server Monitoring** - Real-time server status and configuration
- **Interactive Help** - Built-in documentation and examples
- **Command Interface** - Clean, emoji-free menu system
- **Smart Guidance** - Automatic tips for enabling full functionality

### How to Run

**Option 1: Basic Mode (No Proxy)**
```bash
npm run demo:cli
```
- Shows system diagnostics and environment detection
- Demonstrates what happens when proxy is unavailable
- Limited CORS bypass functionality

**Option 2: Full Mode (With Proxy Server)**
```bash
# Terminal 1: Start proxy server
npm run proxy:start

# Terminal 2: Run CLI demo  
npm run demo:cli
```
- Full CORS bypass functionality
- Real-time proxy server monitoring
- Complete URL testing with before/after comparison

### CLI Commands
```
1) Test Audio URL          - Test any audio URL with CORS bypass
2) System Diagnostics      - Check library capabilities and network
3) Proxy Server Status     - Monitor proxy server health
4) Show Example URLs       - Curated list of test URLs
5) Advanced Features Demo  - Showcase enhanced v1.1.0 features
6) View Test Results       - History of all URL tests
h) Help & Documentation    - Learn about the library
q) Quit System            - Exit the CLI
```

### Visual Features
- **Terminal Effects** - Boot sequences, typing animations, color coding
- **Status Matrices** - Real-time system information display
- **Progress Indicators** - Visual feedback for operations
- **Professional Aesthetic** - Clean, matrix-inspired interface design
- **Smart User Guidance** - Helpful tips appear automatically when needed
- **Environment Detection** - Shows "Node.js CLI" correctly for terminal environment

---

## Technical Details

### Version Detection
Both demos implement dynamic version detection with multiple fallback methods:

1. **Primary**: Proxy server health endpoint (`/health`) - Real-time version
2. **Fallback**: Package.json sources (local and CDN)
3. **Last Resort**: Feature inference based on available methods

### Proxy Status Detection
- Scans multiple ports (3002, 3001, 3003) for available proxy servers
- Real-time status updates and health monitoring
- Automatic failover between different proxy instances
- Dynamic UI updates based on actual server availability

### Multi-Version Support
- Detects multiple installed versions
- Prioritizes local versions over remote ones
- Warns about version conflicts
- Shows all detected versions in console/display

### Environment Detection
- Auto-detects Tauri, Electron, web browser, or Node.js CLI environments
- Shows environment-specific capabilities
- Adapts feature availability based on runtime
- CLI correctly shows "Node.js CLI" instead of "Unknown" for terminal usage

---

## Use Cases

### Web Demo Perfect For:
- **Evaluating before installing** - See the value immediately
- **Testing your URLs** - Verify compatibility before integration
- **Learning the API** - Interactive code examples
- **Demos and presentations** - Live proof of concept
- **Debugging integration** - Test with your actual URLs

### CLI Demo Perfect For:
- **Quick testing** - Fast audio URL validation
- **Debugging** - Terminal-based diagnostics  
- **Presentations** - Professional CLI aesthetic for demos
- **CI/CD pipelines** - Automated testing workflows
- **Server environments** - No browser needed

---

## Example URLs for Testing

### ✅ URLs that demonstrate CORS bypass:
- `https://d3ctxlq1ktw2nl.cloudfront.net/production/2019-6-29/19776794-44100-2-1840c87ba7791.mp3` - Anchor Podcast (CORS Blocked)
- `https://d3ctxlq1ktw2nl.cloudfront.net/production/2019-4-20/15524768-44100-2-08241a87e299b.mp3` - Tech Podcast (CORS Blocked)
- `https://www.learningcontainer.com/wp-content/uploads/2020/02/Kalimba.mp3` - Kalimba MP3 (CORS Blocked)
- `https://www.kozco.com/tech/piano2.wav` - Piano WAV (CORS Blocked)
- `https://traffic.libsyn.com/secure/noclippodcast/233.mp3` - Gaming Podcast (CORS Allowed - for comparison)

### ❌ URLs that will fail (demonstrate library limitations):
- `https://www.youtube.com/watch?v=dQw4w9WgXcQ` - YouTube (Returns HTML)
- `https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT` - Spotify (Web page)
- `https://soundcloud.com/example/track` - SoundCloud (Not direct audio)

---

## Development

### Files Structure
```
demo/
├── README.md              # This file
├── index.html             # Web demo HTML
├── demo-full.js           # Web demo JavaScript
├── cli-demo.js            # CLI demo with hacker interface
├── styles-bandonker-signature.css    # Web demo styles
└── package.json           # Demo dependencies (if any)
```

### Extending the Demos
- Both demos are fully self-contained and can be customized
- CLI demo uses modular command system for easy extension
- Web demo exposes `window.dapDemo` for manual testing
- All version detection logic is reusable across environments

---

---

## ⚠️ Important Notes

### Legal Usage
The warning message in the CLI demo ("Bypassing CORS restrictions in progress...") is a standard legal disclaimer. **Desktop Audio Proxy is completely legal** when used properly:

- ✅ **Accessing public URLs** - Completely legal and intended use
- ✅ **Testing podcast feeds** - These are meant to be accessed
- ✅ **Streaming radio URLs** - Publicly broadcast content
- ✅ **Desktop app development** - Exactly what the library is designed for

The library only accesses **publicly available content** that you already have permission to use. The disclaimer protects the library maintainer and follows standard practices for networking tools.

### Proxy Server Guidance
- **Without Proxy**: CLI shows "OFFLINE" status and provides helpful tips
- **With Proxy**: Full functionality including real CORS bypass testing
- **Automatic Detection**: CLI scans ports 3002, 3001, 3003 for available servers
- **Smart Tips**: Helpful guidance appears automatically when proxy is needed

---

## Enjoy the Demos!

These demonstrations showcase the full power of Desktop Audio Proxy in both visual and terminal environments. Whether you prefer clicking through a web interface or typing commands in a professional CLI, we've got you covered! 

