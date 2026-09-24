/**
 * Real rendering settings system for Lions of Algeria.
 * Every setting maps to actual Three.js/WebGL properties.
 */

import * as THREE from 'three';

export interface GraphicsSettings {
  resolution: '720p' | '1080p' | '1440p' | '2160p' | '4320p' | 'native';
  fpsCap: 30 | 60 | 120 | 0;
  dynamicResolution: boolean;
  antiAliasing: 'none' | 'fxaa' | 'msaa2x' | 'msaa4x';
  shadowQuality: 'off' | 'low' | 'medium' | 'high' | 'ultra';
  textureQuality: 'low' | 'medium' | 'high' | 'ultra';
  effectsQuality: 'low' | 'medium' | 'high' | 'ultra';
  foliageQuality: 'low' | 'medium' | 'high' | 'ultra';
  viewDistance: 'near' | 'medium' | 'far' | 'ultra';
  ambientOcclusion: 'off' | 'low' | 'medium' | 'high';
  reflections: 'off' | 'low' | 'medium' | 'high';
  volumetricEffects: 'off' | 'low' | 'medium' | 'high';
  postProcessing: 'off' | 'low' | 'medium' | 'high';
  lodQuality: 'low' | 'medium' | 'high' | 'ultra';
  particleQuality: 'low' | 'medium' | 'high' | 'ultra';
  waterQuality: 'low' | 'medium' | 'high' | 'ultra';
  showPerformanceOverlay: boolean;
}

export interface DeviceCapabilities {
  maxResolution: { width: number; height: number };
  maxRefreshRate: number;
  gpuRenderer: string;
  maxTextureSize: number;
  maxRenderbufferSize: number;
  hasWebGL2: boolean;
  deviceMemoryGB: number;
  hardwareConcurrency: number;
  isMobile: boolean;
  supportsMSAA: boolean;
  maxAnisotropy: number;
}

export const RESOLUTION_MAP: Record<string, { width: number; height: number }> = {
  '720p':  { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '1440p': { width: 2560, height: 1440 },
  '2160p': { width: 3840, height: 2160 },
  '4320p': { width: 7680, height: 4320 },
};

export const DEFAULT_GRAPHICS: GraphicsSettings = {
  resolution: 'native',
  fpsCap: 60,
  dynamicResolution: true,
  antiAliasing: 'fxaa',
  shadowQuality: 'medium',
  textureQuality: 'high',
  effectsQuality: 'medium',
  foliageQuality: 'medium',
  viewDistance: 'medium',
  ambientOcclusion: 'low',
  reflections: 'low',
  volumetricEffects: 'low',
  postProcessing: 'medium',
  lodQuality: 'medium',
  particleQuality: 'medium',
  waterQuality: 'medium',
  showPerformanceOverlay: false,
};

export function detectCapabilities(): DeviceCapabilities {
  const canvas = document.createElement('canvas');
  let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  try { gl = canvas.getContext('webgl2') as WebGL2RenderingContext; } catch { /* ignore */ }
  if (!gl) try { gl = canvas.getContext('webgl') as WebGLRenderingContext; } catch { /* ignore */ }
  const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);

  const caps: DeviceCapabilities = {
    maxResolution: { width: Math.round(screen.width * (window.devicePixelRatio || 1)), height: Math.round(screen.height * (window.devicePixelRatio || 1)) },
    maxRefreshRate: 60,
    gpuRenderer: debugInfo ? (gl?.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Unknown GPU') : 'Unknown',
    maxTextureSize: gl?.getParameter(gl.MAX_TEXTURE_SIZE) || 2048,
    maxRenderbufferSize: gl?.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 2048,
    hasWebGL2: !!gl && typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext,
    deviceMemoryGB: (navigator as any).deviceMemory || (isMobile ? 4 : 8),
    hardwareConcurrency: navigator.hardwareConcurrency || 4,
    isMobile,
    supportsMSAA: !!gl?.getContextAttributes?.()?.antialias,
    maxAnisotropy: (() => {
      const ext = gl?.getExtension('EXT_texture_filter_anisotropy');
      return ext ? (gl!.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1) : 1;
    })(),
  };

  return caps;
}

export function startRefreshRateDetection(callback: (hz: number) => void): void {
  let count = 0;
  const start = performance.now();
  const check = () => {
    count++;
    const elapsed = performance.now() - start;
    if (elapsed < 600) {
      requestAnimationFrame(check);
    } else {
      const measured = Math.round(count / (elapsed / 1000));
      const hz = measured > 100 ? 120 : measured > 55 ? 60 : 30;
      callback(hz);
    }
  };
  requestAnimationFrame(check);
}

export function validateSettings(gfx: GraphicsSettings, caps: DeviceCapabilities): {
  applied: GraphicsSettings;
  warnings: string[];
} {
  const warnings: string[] = [];
  const applied = { ...gfx };

  if (gfx.resolution !== 'native') {
    const target = RESOLUTION_MAP[gfx.resolution];
    if (target) {
      if (target.width > caps.maxResolution.width * 1.1 || target.height > caps.maxResolution.height * 1.1) {
        warnings.push(`${gfx.resolution} غير مدعوم — تم استخدام أقرب دقة مدعومة.`);
        const entries = Object.entries(RESOLUTION_MAP).reverse();
        for (const [key, res] of entries) {
          if (res.width <= caps.maxResolution.width * 1.1 && res.height <= caps.maxResolution.height * 1.1) {
            applied.resolution = key as GraphicsSettings['resolution'];
            break;
          }
        }
      }
      if (target.width > caps.maxRenderbufferSize || target.height > caps.maxRenderbufferSize) {
        warnings.push(`${gfx.resolution} يتجاوز قدرات الجهاز. تم استخدام 1080p.`);
        applied.resolution = '1080p';
      }
    }
  }

  if (gfx.fpsCap === 120 && caps.maxRefreshRate < 120) {
    warnings.push(`جهازك يدعم حتى ${caps.maxRefreshRate} FPS.`);
    applied.fpsCap = 60;
  }

  if ((gfx.antiAliasing === 'msaa2x' || gfx.antiAliasing === 'msaa4x') && !caps.supportsMSAA) {
    warnings.push('MSAA غير مدعوم. تم التبديل إلى FXAA.');
    applied.antiAliasing = 'fxaa';
  }

  if (caps.deviceMemoryGB <= 4) {
    if (applied.textureQuality === 'ultra') applied.textureQuality = 'high';
    if (applied.shadowQuality === 'ultra') applied.shadowQuality = 'high';
  }
  if (caps.isMobile) {
    if (applied.reflections === 'high') applied.reflections = 'medium';
    if (applied.volumetricEffects === 'high') applied.volumetricEffects = 'medium';
  }

  return { applied, warnings };
}

export function applyGraphicsSettings(
  renderer: THREE.WebGLRenderer,
  gfx: GraphicsSettings,
  container: HTMLElement,
): { renderWidth: number; renderHeight: number } {
  const containerW = container.clientWidth || window.innerWidth;
  const containerH = container.clientHeight || window.innerHeight;

  let renderW = containerW;
  let renderH = containerH;

  if (gfx.resolution !== 'native') {
    const target = RESOLUTION_MAP[gfx.resolution];
    if (target) {
      const scale = Math.min(target.width / containerW, target.height / containerH, 2);
      renderW = Math.round(containerW * scale);
      renderH = Math.round(containerH * scale);
    }
  }

  const pixelRatio = Math.min(renderW / containerW, 2);
  renderer.setPixelRatio(pixelRatio || 1);

  const shadowEnabled = gfx.shadowQuality !== 'off';
  renderer.shadowMap.enabled = shadowEnabled;
  if (shadowEnabled) {
    renderer.shadowMap.type = gfx.shadowQuality === 'ultra'
      ? THREE.PCFSoftShadowMap
      : gfx.shadowQuality === 'high'
        ? THREE.PCFShadowMap
        : THREE.BasicShadowMap;
  }

  renderer.toneMapping = gfx.postProcessing !== 'off'
    ? THREE.ACESFilmicToneMapping
    : THREE.LinearToneMapping;
  renderer.toneMappingExposure = gfx.postProcessing === 'high' ? 1.15 : gfx.postProcessing === 'medium' ? 1.08 : 1.0;

  renderer.setSize(renderW, renderH, false);
  renderer.domElement.style.width = `${containerW}px`;
  renderer.domElement.style.height = `${containerH}px`;

  return { renderWidth: renderW, renderHeight: renderH };
}

export function getPresetSettings(preset: 'low' | 'medium' | 'high' | 'ultra'): GraphicsSettings {
  const base = { ...DEFAULT_GRAPHICS };
  switch (preset) {
    case 'low':
      return { ...base, resolution: '720p', antiAliasing: 'none', shadowQuality: 'off', textureQuality: 'low', effectsQuality: 'low', foliageQuality: 'low', viewDistance: 'near', ambientOcclusion: 'off', reflections: 'off', volumetricEffects: 'off', postProcessing: 'off', lodQuality: 'low', particleQuality: 'low', waterQuality: 'low', dynamicResolution: false };
    case 'medium':
      return { ...base, resolution: '1080p', antiAliasing: 'fxaa', shadowQuality: 'low', textureQuality: 'medium', effectsQuality: 'medium', foliageQuality: 'medium', viewDistance: 'medium', ambientOcclusion: 'low', reflections: 'low', volumetricEffects: 'low', postProcessing: 'low', lodQuality: 'medium', particleQuality: 'medium', waterQuality: 'medium' };
    case 'high':
      return { ...base, resolution: '1080p', antiAliasing: 'fxaa', shadowQuality: 'high', textureQuality: 'high', effectsQuality: 'high', foliageQuality: 'high', viewDistance: 'far', ambientOcclusion: 'medium', reflections: 'medium', volumetricEffects: 'medium', postProcessing: 'high', lodQuality: 'high', particleQuality: 'high', waterQuality: 'high' };
    case 'ultra':
      return { ...base, resolution: '2160p', antiAliasing: 'msaa4x', shadowQuality: 'ultra', textureQuality: 'ultra', effectsQuality: 'ultra', foliageQuality: 'ultra', viewDistance: 'ultra', ambientOcclusion: 'high', reflections: 'high', volumetricEffects: 'high', postProcessing: 'high', lodQuality: 'ultra', particleQuality: 'ultra', waterQuality: 'ultra' };
  }
}

export function getShadowMapSize(quality: GraphicsSettings['shadowQuality']): number {
  switch (quality) {
    case 'off': return 0;
    case 'low': return 512;
    case 'medium': return 1024;
    case 'high': return 2048;
    case 'ultra': return 4096;
  }
}

export function getFogDistance(viewDistance: GraphicsSettings['viewDistance']): { near: number; far: number } {
  switch (viewDistance) {
    case 'near': return { near: 30, far: 120 };
    case 'medium': return { near: 55, far: 235 };
    case 'far': return { near: 80, far: 380 };
    case 'ultra': return { near: 120, far: 550 };
  }
}