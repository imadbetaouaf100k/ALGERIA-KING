import { useRef, useState } from 'react';

interface PerformanceData {
  fps: number;
  renderWidth: number;
  renderHeight: number;
  renderScale: number;
  gpuLoad: string;
  memoryUsed: string;
  frameTime: number;
  drawCalls: number;
}

export function usePerformanceMonitor(_enabled: boolean) {
  const [data, setData] = useState<PerformanceData>({
    fps: 0, renderWidth: 0, renderHeight: 0, renderScale: 100,
    gpuLoad: '--', memoryUsed: '--', frameTime: 0, drawCalls: 0,
  });
  const frames = useRef<number[]>([]);
  const lastUpdate = useRef(0);

  const recordFrame = (renderer?: { info: { render: { calls: number } } }) => {
    frames.current.push(performance.now());
    const now = performance.now();
    // Keep only the last 2 seconds of frames
    frames.current = frames.current.filter(t => now - t < 2000);
    
    if (now - lastUpdate.current < 300) return; // Update UI at ~3Hz
    lastUpdate.current = now;

    const fps = frames.current.length > 1 
      ? Math.round((frames.current.length - 1) / ((frames.current[frames.current.length - 1] - frames.current[0]) / 1000))
      : 0;

    let memoryUsed = '--';
    try {
      const perf = performance as any;
      if (perf.memory) {
        memoryUsed = `${(perf.memory.usedJSHeapSize / 1073741824).toFixed(1)} GB`;
      }
    } catch { /* not available */ }

    const drawCalls = renderer?.info.render.calls ?? 0;
    const frameTime = frames.current.length > 1 
      ? Math.round((frames.current[frames.current.length - 1] - frames.current[Math.max(0, frames.current.length - 2)]) * 10) / 10
      : 0;

    setData({ fps, renderWidth: 0, renderHeight: 0, renderScale: 100, gpuLoad: '--', memoryUsed, frameTime, drawCalls });
  };

  return { data, recordFrame };
}

export default function PerformanceOverlay({ 
  visible, 
  data
}: { 
  visible: boolean;
  data: PerformanceData;
}) {
  if (!visible) return null;

  const fpsColor = data.fps >= 55 ? '#6dff8e' : data.fps >= 30 ? '#ffd06d' : '#ff6d6d';

  return (
    <div className="performance-overlay">
      <div className="perf-row">
        <span className="perf-label">FPS</span>
        <span className="perf-value" style={{ color: fpsColor }}>{data.fps}</span>
      </div>
      {data.renderWidth > 0 && (
        <div className="perf-row">
          <span className="perf-label">Resolution</span>
          <span className="perf-value">{data.renderWidth}×{data.renderHeight}</span>
        </div>
      )}
      <div className="perf-row">
        <span className="perf-label">Frame Time</span>
        <span className="perf-value">{data.frameTime.toFixed(1)}ms</span>
      </div>
      <div className="perf-row">
        <span className="perf-label">Draw Calls</span>
        <span className="perf-value">{data.drawCalls}</span>
      </div>
      <div className="perf-row">
        <span className="perf-label">Memory</span>
        <span className="perf-value">{data.memoryUsed}</span>
      </div>
    </div>
  );
}