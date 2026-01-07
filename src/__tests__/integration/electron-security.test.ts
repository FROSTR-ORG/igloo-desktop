/**
 * Security tests for Electron configuration
 *
 * These tests verify that critical security settings are properly configured
 * to prevent XSS and code injection attacks.
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Electron Security Configuration', () => {
  let mainTsContent: string;

  beforeAll(() => {
    // Read the main.ts file to verify security settings
    const mainTsPath = path.join(__dirname, '../../main.ts');
    mainTsContent = fs.readFileSync(mainTsPath, 'utf-8');
  });

  describe('BrowserWindow webPreferences', () => {
    it('should have nodeIntegration set to false', () => {
      // Verify nodeIntegration is explicitly set to false
      expect(mainTsContent).toMatch(/nodeIntegration:\s*false/);
      expect(mainTsContent).not.toMatch(/nodeIntegration:\s*true/);
    });

    it('should have contextIsolation set to true', () => {
      // Verify contextIsolation is explicitly set to true
      expect(mainTsContent).toMatch(/contextIsolation:\s*true/);
      expect(mainTsContent).not.toMatch(/contextIsolation:\s*false/);
    });

    it('should have sandbox enabled', () => {
      // Verify sandbox is enabled
      expect(mainTsContent).toMatch(/sandbox:\s*true/);
    });

    it('should specify a preload script', () => {
      // Verify a preload script is configured
      expect(mainTsContent).toMatch(/preload:\s*path\.join\(__dirname,\s*['"]preload\.js['"]\)/);
    });

    it('should NOT have webSecurity disabled', () => {
      // Ensure webSecurity is not disabled (it's enabled by default)
      expect(mainTsContent).not.toMatch(/webSecurity:\s*false/);
    });

    it('should NOT have allowRunningInsecureContent enabled', () => {
      // Ensure insecure content is not allowed
      expect(mainTsContent).not.toMatch(/allowRunningInsecureContent:\s*true/);
    });

    it('should NOT enable remote module', () => {
      // Remote module is deprecated and dangerous
      expect(mainTsContent).not.toMatch(/enableRemoteModule:\s*true/);
    });
  });

  describe('Preload Script', () => {
    let preloadContent: string;

    beforeAll(() => {
      const preloadPath = path.join(__dirname, '../../preload.ts');
      preloadContent = fs.readFileSync(preloadPath, 'utf-8');
    });

    it('should exist', () => {
      expect(preloadContent).toBeDefined();
      expect(preloadContent.length).toBeGreaterThan(0);
    });

    it('should use contextBridge.exposeInMainWorld', () => {
      // Verify the preload script uses contextBridge for safe exposure
      expect(preloadContent).toMatch(/contextBridge\.exposeInMainWorld/);
    });

    it('should expose electronAPI to renderer', () => {
      // Verify the API is exposed under the correct name
      expect(preloadContent).toMatch(/exposeInMainWorld\(\s*['"]electronAPI['"]/);
    });

    it('should NOT directly expose ipcRenderer', () => {
      // Ensure raw ipcRenderer is not exposed to renderer
      // It should only be used internally in the preload script
      expect(preloadContent).not.toMatch(/exposeInMainWorld\([^)]*ipcRenderer[^)]*\)/);
    });

    it('should expose only specific IPC methods', () => {
      // Verify only the expected methods are exposed
      expect(preloadContent).toMatch(/getShares:/);
      expect(preloadContent).toMatch(/saveShare:/);
      expect(preloadContent).toMatch(/deleteShare:/);
      expect(preloadContent).toMatch(/openShareLocation:/);
      expect(preloadContent).toMatch(/computeRelayPlan:/);
      expect(preloadContent).toMatch(/echoStart:/);
      expect(preloadContent).toMatch(/echoStop:/);
      expect(preloadContent).toMatch(/onEchoReceived:/);
      expect(preloadContent).toMatch(/onEchoError:/);
    });

    it('should return cleanup functions for event listeners', () => {
      // Verify event listeners return cleanup functions
      expect(preloadContent).toMatch(/onEchoReceived:.*return\s*\(\)\s*=>/s);
      expect(preloadContent).toMatch(/onEchoError:.*return\s*\(\)\s*=>/s);
    });
  });
});

describe('Content Security Policy', () => {
  let indexHtmlContent: string;

  beforeAll(() => {
    const indexPath = path.join(__dirname, '../../../index.html');
    indexHtmlContent = fs.readFileSync(indexPath, 'utf-8');
  });

  it('should have a Content-Security-Policy meta tag', () => {
    expect(indexHtmlContent).toMatch(/<meta\s+http-equiv=["']Content-Security-Policy["']/i);
  });

  it('should restrict default-src to self', () => {
    expect(indexHtmlContent).toMatch(/default-src\s+['"]self['"]/);
  });

  it('should restrict script-src to self', () => {
    expect(indexHtmlContent).toMatch(/script-src\s+['"]self['"]/);
  });

  it('should NOT allow unsafe-eval in scripts', () => {
    // Check that script-src doesn't include unsafe-eval
    const scriptSrcMatch = indexHtmlContent.match(/script-src[^;]*/);
    if (scriptSrcMatch) {
      expect(scriptSrcMatch[0]).not.toContain('unsafe-eval');
    }
  });

  it('should restrict style-src appropriately', () => {
    // Styles need unsafe-inline for Tailwind and Google Fonts CSS
    expect(indexHtmlContent).toMatch(/style-src[^;]*['"]self['"]/);
    expect(indexHtmlContent).toMatch(/style-src[^;]*fonts\.googleapis\.com/);
  });

  it('should restrict font-src to self and Google Fonts', () => {
    expect(indexHtmlContent).toMatch(/font-src[^;]*['"]self['"]/);
    expect(indexHtmlContent).toMatch(/font-src[^;]*fonts\.gstatic\.com/);
  });

  it('should restrict img-src to self and data URIs', () => {
    expect(indexHtmlContent).toMatch(/img-src[^;]*['"]self['"]/);
    expect(indexHtmlContent).toMatch(/img-src[^;]*data:/);
  });

  it('should restrict connect-src for WebSocket connections', () => {
    // Allow wss: for secure WebSocket relay connections
    expect(indexHtmlContent).toMatch(/connect-src[^;]*wss:/);
  });

  it('should set base-uri to self', () => {
    expect(indexHtmlContent).toMatch(/base-uri\s+['"]self['"]/);
  });

  it('should disable form-action', () => {
    expect(indexHtmlContent).toMatch(/form-action\s+['"]none['"]/);
  });

  it('should set frame-ancestors to none', () => {
    // Prevent clickjacking
    expect(indexHtmlContent).toMatch(/frame-ancestors\s+['"]none['"]/);
  });
});

describe('Renderer Code Security', () => {
  it('should not directly import ipcRenderer in clientShareManager', () => {
    const clientShareManagerPath = path.join(__dirname, '../../lib/clientShareManager.ts');
    const content = fs.readFileSync(clientShareManagerPath, 'utf-8');

    // Should not have direct electron import
    expect(content).not.toMatch(/import\s*{\s*ipcRenderer\s*}\s*from\s*['"]electron['"]/);
    expect(content).not.toMatch(/require\s*\(\s*['"]electron['"]\s*\)/);

    // Should use window.electronAPI instead
    expect(content).toMatch(/window\.electronAPI\./);
  });

  it('should not directly import ipcRenderer in Keyset component', () => {
    const keysetPath = path.join(__dirname, '../../components/Keyset.tsx');
    const content = fs.readFileSync(keysetPath, 'utf-8');

    // Should not have direct electron import
    expect(content).not.toMatch(/import\s*{\s*ipcRenderer\s*}\s*from\s*['"]electron['"]/);

    // Should use window.electronAPI instead
    expect(content).toMatch(/window\.electronAPI\./);
  });
});
