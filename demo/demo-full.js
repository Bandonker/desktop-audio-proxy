import {
  createAudioClient,
  createMediaElementController,
} from '../dist/browser.esm.js';

const PROXY_PORTS = [3002, 3001, 3003];
const REQUEST_TIMEOUT_MS = 8000;

function byId(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing demo element: #${id}`);
  return element;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function setResult(prefix, state, message) {
  const status = byId(
    prefix === 'proxy' ? 'proxy-test-status' : `${prefix}-status`
  );
  const details = byId(`${prefix}-details`);
  const result = byId(`${prefix}-result`);
  status.className = `status-indicator ${state}`;
  status.textContent =
    state === 'success'
      ? 'Reachable'
      : state === 'error'
        ? 'Blocked'
        : 'Testing';
  details.textContent = message;
  result.classList.toggle('success', state === 'success');
  result.classList.toggle('error', state === 'error');
}

class RadioDemo {
  constructor() {
    this.proxyUrl = null;
    this.health = null;
    this.client = null;
    this.controller = null;
  }

  async initialize() {
    this.setupTabs();
    this.setupPresets();
    this.setupPlayer();
    await this.findProxy();
    this.renderStatus();

    window.dapDemo = {
      get proxyUrl() {
        return radioDemo.proxyUrl;
      },
      testUrl: url => this.testUrl(url),
      stop: () => this.controller?.stop(),
      state: () => ({
        proxyUrl: this.proxyUrl,
        health: this.health,
        controllerReady: Boolean(this.controller),
      }),
    };
  }

  setupPlayer() {
    const audio = byId('proxy-player');
    const form = byId('station-form');
    const stopButton = byId('stop-btn');

    form.addEventListener('submit', event => {
      event.preventDefault();
      void this.testUrl(byId('audio-url').value.trim());
    });
    stopButton.addEventListener('click', () => {
      this.controller?.stop();
      byId('controller-status').className = 'status-indicator';
      byId('controller-status').textContent = 'Stopped';
    });

    window.addEventListener(
      'beforeunload',
      () => {
        void this.controller?.dispose();
      },
      { once: true }
    );

    this.audioElement = audio;
  }

  setupPresets() {
    for (const button of document.querySelectorAll('[data-url]')) {
      button.addEventListener('click', () => {
        byId('audio-url').value = button.dataset.url;
      });
    }
  }

  setupTabs() {
    for (const button of document.querySelectorAll('[data-tab]')) {
      button.addEventListener('click', () => {
        const selected = button.dataset.tab;
        for (const tab of document.querySelectorAll('[data-tab]')) {
          const active = tab.dataset.tab === selected;
          tab.classList.toggle('active', active);
          tab.setAttribute('aria-selected', String(active));
        }
        for (const panel of document.querySelectorAll('.code-content')) {
          const active = panel.id === `${selected}-code`;
          panel.classList.toggle('active', active);
          panel.hidden = !active;
        }
      });
    }

    for (const button of document.querySelectorAll('[data-copy]')) {
      button.addEventListener('click', async () => {
        const code = byId(`${button.dataset.copy}-code`).querySelector('code');
        await navigator.clipboard.writeText(code?.textContent ?? '');
        button.textContent = 'Copied';
        setTimeout(() => {
          button.textContent = 'Copy';
        }, 1500);
      });
    }
  }

  async findProxy() {
    for (const port of PROXY_PORTS) {
      const proxyUrl = `http://localhost:${port}`;
      try {
        const response = await fetchWithTimeout(`${proxyUrl}/health`);
        if (!response.ok) continue;
        const health = await response.json();
        if (health.status !== 'ok') continue;

        this.proxyUrl = proxyUrl;
        this.health = health;
        this.client = createAudioClient({
          proxyUrl,
          autoDetect: false,
          autoStartProxy: false,
          fallbackToOriginal: false,
          retryAttempts: 2,
        });
        this.controller = createMediaElementController(this.audioElement, {
          proxyUrl,
          autoDetect: false,
          autoStartProxy: false,
          fallbackToOriginal: false,
          retryAttempts: 2,
        });
        return;
      } catch {
        // Continue checking the small known local port set.
      }
    }
  }

  renderStatus() {
    byId('environment').textContent = 'Web browser';
    byId('library-version').textContent = this.health?.version ?? 'Local build';

    if (this.proxyUrl && this.health) {
      byId('proxy-status').textContent =
        `Ready · ${new URL(this.proxyUrl).port}`;
      byId('network-policy').textContent = this.health.config
        .allowPrivateAddresses
        ? 'Private hosts enabled'
        : 'Public hosts only';
      byId('controller-status').className = 'status-indicator success';
      byId('controller-status').textContent = 'Controller ready';
    } else {
      byId('proxy-status').textContent = 'Offline';
      byId('network-policy').textContent = 'Unavailable';
      byId('controller-status').className = 'status-indicator error';
      byId('controller-status').textContent = 'Start npm run demo';
    }
  }

  async testUrl(url) {
    if (!url) return;
    setResult('direct', 'loading', 'Checking the upstream CORS response…');
    setResult('proxy', 'loading', 'Validating the local proxy path…');
    byId('controller-status').className = 'status-indicator loading';
    byId('controller-status').textContent = 'Preparing';

    await Promise.allSettled([this.testDirect(url), this.testProxy(url)]);
  }

  async testDirect(url) {
    try {
      const response = await fetchWithTimeout(url, {
        headers: { Range: 'bytes=0-0' },
      });
      if (!response.ok && response.status !== 206) {
        throw new Error(`HTTP ${response.status}`);
      }
      setResult(
        'direct',
        'success',
        'This upstream already permits cross-origin browser requests.'
      );
    } catch (error) {
      const reason =
        error instanceof Error && error.name === 'AbortError'
          ? 'The direct request timed out.'
          : 'The browser blocked or could not reach the direct request.';
      setResult('direct', 'error', reason);
    }
  }

  async testProxy(url) {
    if (!this.controller || !this.client || !this.proxyUrl) {
      setResult(
        'proxy',
        'error',
        'Start the full demo to run the local proxy.'
      );
      byId('controller-status').className = 'status-indicator error';
      byId('controller-status').textContent = 'Proxy offline';
      return;
    }

    try {
      const playableUrl = await this.controller.load(url);
      if (!playableUrl) throw new Error('Station request was superseded');
      const response = await fetchWithTimeout(playableUrl, {
        headers: { Range: 'bytes=0-0' },
      });
      if (!response.ok && response.status !== 206) {
        throw new Error(`Proxy returned HTTP ${response.status}`);
      }
      setResult(
        'proxy',
        'success',
        `Validated through ${this.proxyUrl}; press play when ready.`
      );
      byId('controller-status').className = 'status-indicator success';
      byId('controller-status').textContent = 'Stream ready';
    } catch (error) {
      setResult(
        'proxy',
        'error',
        error instanceof Error ? error.message : 'Proxy request failed.'
      );
      byId('controller-status').className = 'status-indicator error';
      byId('controller-status').textContent = 'Request failed';
    }
  }
}

const radioDemo = new RadioDemo();
radioDemo.initialize().catch(error => {
  console.error('Demo initialization failed:', error);
  byId('controller-status').className = 'status-indicator error';
  byId('controller-status').textContent = 'Initialization failed';
});
