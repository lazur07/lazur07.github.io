import { useState } from "react";

// Damped spring step response: x(t) = 1 - e^{-ζωt}(cos ω_d t + (ζ/√(1-ζ²)) sin ω_d t)
export default function Slider() {
  const [zeta, setZeta] = useState(0.2);
  const omega = 2;
  const w = 640;
  const h = 220;
  const pad = 24;
  const n = 300;
  const tMax = 12;

  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * tMax;
    const wd = omega * Math.sqrt(Math.max(1 - zeta * zeta, 1e-6));
    const x = 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * t));
    pts.push(`${pad + (t / tMax) * (w - 2 * pad)},${h - pad - x * ((h - 2 * pad) / 2)}`);
  }
  const yOne = h - pad - (h - 2 * pad) / 2;

  return (
    <div className="demo">
      <label>
        damping ratio ζ = {zeta.toFixed(2)}
        <input type="range" min="0.02" max="0.99" step="0.01" value={zeta} onChange={(e) => setZeta(Number(e.target.value))} />
      </label>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Step response of a damped spring">
        <line x1={pad} y1={yOne} x2={w - pad} y2={yOne} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="4 4" />
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="currentColor" strokeOpacity="0.4" />
        <polyline points={pts.join(" ")} fill="none" stroke="var(--blue)" strokeWidth="1.8" />
      </svg>
    </div>
  );
}
