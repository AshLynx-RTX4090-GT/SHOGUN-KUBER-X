import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Cloud, Database, GitBranch, Layers3, LockKeyhole, Radio, Server, ShieldCheck } from 'lucide-react';

const LOGOS = [
  { label: 'AWS EKS', icon: Cloud, color: 'text-orange-300' },
  { label: 'Kubernetes', icon: Layers3, color: 'text-sky-300' },
  { label: 'Prometheus', icon: Radio, color: 'text-amber-300' },
  { label: 'Grafana', icon: Database, color: 'text-orange-400' },
  { label: 'Terraform', icon: GitBranch, color: 'text-violet-300' },
  { label: 'Vault Security', icon: LockKeyhole, color: 'text-emerald-300' },
  { label: 'S3 Storage', icon: Server, color: 'text-cyan-300' },
  { label: 'RBAC Control', icon: ShieldCheck, color: 'text-rose-300' },
];

const VERTEX_SHADER = 'attribute vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }';
const FRAGMENT_SHADER = 'precision mediump float; uniform float time; void main() { vec2 uv = gl_FragCoord.xy / 900.0; float wave = sin(uv.x * 5.0 + time) * 0.04 + cos(uv.y * 7.0 - time * 0.7) * 0.04; gl_FragColor = vec4(0.02 + wave, 0.08 + wave, 0.16 + wave * 2.0, 0.72); }';

const WebGLBackdrop: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('webgl', { alpha: true, antialias: false });
    if (!canvas || !context) return;
    const compile = (type: number, source: string) => {
      const shader = context.createShader(type);
      if (!shader) return null;
      context.shaderSource(shader, source);
      context.compileShader(shader);
      return shader;
    };
    const vertexShader = compile(context.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compile(context.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;
    const program = context.createProgram();
    if (!program) return;
    context.attachShader(program, vertexShader);
    context.attachShader(program, fragmentShader);
    context.linkProgram(program);
    context.useProgram(program);
    const buffer = context.createBuffer();
    context.bindBuffer(context.ARRAY_BUFFER, buffer);
    context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), context.STATIC_DRAW);
    const position = context.getAttribLocation(program, 'position');
    context.enableVertexAttribArray(position);
    context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0);
    const timeUniform = context.getUniformLocation(program, 'time');
    let frameId = 0;
    const draw = (time: number) => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth * pixelRatio;
      const height = canvas.clientHeight * pixelRatio;
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; context.viewport(0, 0, width, height); }
      context.uniform1f(timeUniform, time * 0.001);
      context.drawArrays(context.TRIANGLE_STRIP, 0, 4);
      frameId = requestAnimationFrame(draw);
    };
    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, []);
  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full opacity-90" />;
};

export const DeveloperMarquee: React.FC = () => {
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(0);
  const targetRef = useRef(0);
  const velocityRef = useRef(0);
  const pointerRef = useRef({ x: 0, position: 0 });
  const frameRef = useRef(0);
  useEffect(() => {
    const animate = () => {
      if (!isPaused && !isDragging) {
        targetRef.current -= 0.32;
        const trackWidth = trackRef.current?.scrollWidth || 1;
        if (targetRef.current < -trackWidth / 2) targetRef.current += trackWidth / 2;
        const springForce = (targetRef.current - positionRef.current) * 0.08;
        velocityRef.current = (velocityRef.current + springForce) * 0.82;
        positionRef.current += velocityRef.current;
        if (trackRef.current) trackRef.current.style.transform = `translate3d(${positionRef.current}px, 0, 0)`;
      }
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [isDragging, isPaused]);
  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => { event.currentTarget.setPointerCapture(event.pointerId); pointerRef.current = { x: event.clientX, position: positionRef.current }; setIsDragging(true); };
  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => { if (!isDragging) return; targetRef.current = pointerRef.current.position + event.clientX - pointerRef.current.x; positionRef.current = targetRef.current; velocityRef.current = 0; if (trackRef.current) trackRef.current.style.transform = `translate3d(${positionRef.current}px, 0, 0)`; };
  const endDrag = () => setIsDragging(false);
  return <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-950 min-h-32 select-none">
    <WebGLBackdrop />
    <div className="relative z-10 px-5 pt-4 flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.22em] text-cyan-300 font-mono">Connected platform fabric</p><h2 className="text-sm font-bold text-white mt-1">One operational view, every layer in motion</h2></div><span className="text-[10px] text-slate-300 font-mono hidden sm:block">{isDragging ? 'DRAGGING' : isPaused ? 'PAUSED' : 'LIVE'} · GPU</span></div>
    <div className="relative z-10 overflow-hidden mt-4 pb-5" onPointerEnter={() => setIsPaused(true)} onPointerLeave={() => { setIsPaused(false); endDrag(); }} onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}><div ref={trackRef} className="flex w-max gap-3 will-change-transform">{[...LOGOS, ...LOGOS].map(({ label, icon: Icon, color }, index) => <div key={`${label}-${index}`} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/10 text-xs font-semibold text-white whitespace-nowrap backdrop-blur-md"><Icon className={`w-4 h-4 ${color}`} />{label}</div>)}</div></div>
  </motion.section>;
};
