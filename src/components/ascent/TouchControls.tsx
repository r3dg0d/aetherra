"use client";

interface Actions {
  launch: () => void; stage: () => void; throttle: (v: number) => void; hold: (code: string, on: boolean) => void;
  assist: () => void; warp: (d: 1 | -1) => void; cam: () => void; map: () => void;
}

function HoldButton({ code, label, children, hold }: { code: string; label: string; children: React.ReactNode; hold: Actions["hold"] }) {
  return (
    <button
      className="touch-btn" aria-label={label}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); hold(code, true); }}
      onPointerUp={() => hold(code, false)} onPointerCancel={() => hold(code, false)} onLostPointerCapture={() => hold(code, false)}
      onContextMenu={(e) => e.preventDefault()}
    >{children}</button>
  );
}

/** On-screen flight controls for touch devices and small screens (shown via CSS media queries). */
export function TouchControls({ throttle, assist, padReady, actions }: { throttle: number; assist: boolean; padReady: boolean; actions: Actions }) {
  return (
    <div className="touch-controls ui-chrome pointer-events-none absolute inset-x-0 z-20 flex items-end justify-between px-3" style={{ bottom: "calc(env(safe-area-inset-bottom) + 108px)" }} data-testid="touch-controls">
      <div className="pointer-events-auto grid grid-cols-3 gap-1.5" role="group" aria-label="Attitude">
        <span />
        <HoldButton code="KeyS" label="Pitch up" hold={actions.hold}>▲</HoldButton>
        <span />
        <HoldButton code="KeyA" label="Heading left" hold={actions.hold}>◀</HoldButton>
        <button className={`touch-btn text-[10px] ${assist ? "touch-btn-on" : ""}`} onClick={actions.assist} aria-pressed={assist} aria-label="Toggle assist autopilot">AST</button>
        <HoldButton code="KeyD" label="Heading right" hold={actions.hold}>▶</HoldButton>
        <button className="touch-btn text-[10px]" onClick={() => actions.warp(-1)} aria-label="Slower time warp">«</button>
        <HoldButton code="KeyW" label="Pitch down" hold={actions.hold}>▼</HoldButton>
        <button className="touch-btn text-[10px]" onClick={() => actions.warp(1)} aria-label="Faster time warp">»</button>
      </div>
      <div className="pointer-events-auto flex flex-col items-center gap-2">
        {padReady
          ? <button className="touch-btn touch-btn-wide touch-btn-go" onClick={actions.launch}>LAUNCH</button>
          : <button className="touch-btn touch-btn-wide" onClick={actions.stage}>STAGE</button>}
        <div className="flex gap-1.5">
          <button className="touch-btn text-[10px]" onClick={actions.cam} aria-label="Cycle camera">CAM</button>
          <button className="touch-btn text-[10px]" onClick={actions.map} aria-label="Toggle map view">MAP</button>
        </div>
      </div>
      <label className="pointer-events-auto flex flex-col items-center gap-1 text-[10px] text-starlight/70">
        <span className="mono">{Math.round(throttle * 100)}%</span>
        <input type="range" min={0} max={1} step={0.01} value={throttle} onChange={(e) => actions.throttle(Number(e.target.value))} className="throttle-slider" aria-label="Throttle" />
        <span className="label">THR</span>
      </label>
    </div>
  );
}
