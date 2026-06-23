// Keeps the original behaviour: constant gentle flow, mouse leaves a fading
// trail, a smoothed "light" follows the cursor, clicks send a ripple pulse.
// The canvas is a fixed, pointer-events:none layer behind the page content.
(function(){
  const canvas = document.getElementById('bg');
  if(!canvas) return;
  const gl = canvas.getContext('webgl', { antialias:false, alpha:false, premultipliedAlpha:false, preserveDrawingBuffer:true });
  if(!gl){ canvas.style.background = '#0a0b10'; return; }

  const TRAIL_MAX = 24, RIPPLE_MAX = 6;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  function sh(type, src){
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(vsrc, fsrc){
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vsrc));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fsrc));
    gl.bindAttribLocation(p, 0, 'a_pos');
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const progs = window.SHADERS.map(s => {
    const prog = program(window.VERT, s.frag);
    const u = {};
    ['u_res','u_time','u_mouse','u_pointer','u_energy','u_trail','u_trailLen','u_ripple','u_rippleLen']
      .forEach(n => u[n] = gl.getUniformLocation(prog, n));
    return { prog, u };
  });

  let current = 0;
  let W = 0, H = 0;
  const start = performance.now();

  let mx = -1e4, my = -1e4, smx = 0, smy = 0, energy = 0;
  let lastMoveX = 0, lastMoveY = 0, lastMoveT = performance.now();

  const trail = [], ripples = [];
  const trailBuf  = new Float32Array(TRAIL_MAX*3);
  const rippleBuf = new Float32Array(RIPPLE_MAX*3);

  function resize(){
    const w = Math.floor(innerWidth * DPR), h = Math.floor(innerHeight * DPR);
    if(w===W && h===H) return;
    W=w; H=h; canvas.width=w; canvas.height=h;
    gl.viewport(0,0,w,h);
  }
  window.addEventListener('resize', resize);

  function toGL(cx, cy){ return [cx*DPR, (innerHeight - cy)*DPR]; }
  function onMove(cx, cy){
    const [gx, gy] = toGL(cx, cy);
    mx = gx; my = gy;
    const now = performance.now();
    const dt = Math.max(now - lastMoveT, 1)/1000;
    const sp = Math.hypot(gx-lastMoveX, gy-lastMoveY)/dt;
    energy = Math.min(1, energy + Math.min(sp/(H*2.2), 0.18));
    lastMoveX=gx; lastMoveY=gy; lastMoveT=now;
    const last = trail[trail.length-1];
    if(!last || Math.hypot(gx-last.x, gy-last.y) > 0.012*H){
      trail.push({ x:gx, y:gy, t:(now-start)/1000 });
      if(trail.length > TRAIL_MAX) trail.shift();
    }
  }
  function onDown(cx, cy){
    const [gx, gy] = toGL(cx, cy);
    ripples.push({ x:gx, y:gy, t:(performance.now()-start)/1000 });
    if(ripples.length > RIPPLE_MAX) ripples.shift();
    energy = Math.min(1, energy + 0.55);
  }

  window.addEventListener('pointermove', e => onMove(e.clientX, e.clientY), { passive:true });
  window.addEventListener('pointerdown', e => {
    if(e.target.closest('a, button, input, textarea, label, .no-ripple')) return;
    onDown(e.clientX, e.clientY);
  }, { passive:true });

  function render(){
    resize();
    const time = (performance.now()-start)/1000;
    if(mx < -1e3){ smx = W*0.5; smy = H*0.5; }
    smx += (mx - smx)*0.08;
    smy += (my - smy)*0.08;
    energy *= 0.965;

    while(trail.length && time - trail[0].t > 1.2) trail.shift();
    const tc = Math.min(trail.length, TRAIL_MAX);
    for(let i=0;i<tc;i++){ const p = trail[trail.length - tc + i]; trailBuf[i*3]=p.x; trailBuf[i*3+1]=p.y; trailBuf[i*3+2]=p.t; }
    while(ripples.length && time - ripples[0].t > 2.5) ripples.shift();
    const rc = Math.min(ripples.length, RIPPLE_MAX);
    for(let i=0;i<rc;i++){ const r = ripples[ripples.length - rc + i]; rippleBuf[i*3]=r.x; rippleBuf[i*3+1]=r.y; rippleBuf[i*3+2]=r.t; }

    const { prog, u } = progs[current];
    gl.useProgram(prog);
    gl.uniform2f(u.u_res, W, H);
    gl.uniform1f(u.u_time, time);
    gl.uniform2f(u.u_mouse, mx<-1e3? W*0.5 : mx, my<-1e3? H*0.5 : my);
    gl.uniform2f(u.u_pointer, smx, smy);
    gl.uniform1f(u.u_energy, energy);
    gl.uniform3fv(u.u_trail, trailBuf);
    gl.uniform1i(u.u_trailLen, tc);
    gl.uniform3fv(u.u_ripple, rippleBuf);
    gl.uniform1i(u.u_rippleLen, rc);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(render);
  }

  // ---- optional background switcher (any [data-bg-cycle] button) ----
  const cycleBtn = document.querySelector('[data-bg-cycle]');
  const labelEl  = document.querySelector('[data-bg-label]');
  function setLabel(){ if(labelEl) labelEl.textContent = window.SHADERS[current].name; }
  function select(i){
    current = ((i % progs.length) + progs.length) % progs.length;
    setLabel();
    try { localStorage.setItem('portfolio.bg', String(current)); } catch(e){}
  }
  if(cycleBtn) cycleBtn.addEventListener('click', () => select(current + 1));
  window.addEventListener('keydown', e => {
    const n = parseInt(e.key, 10);
    if(n>=1 && n<=progs.length) select(n-1);
  });

  let saved = 0;
  try { saved = parseInt(localStorage.getItem('portfolio.bg')||'0', 10) || 0; } catch(e){}
  if(saved<0 || saved>=progs.length) saved = 0;

  resize();
  select(saved);
  requestAnimationFrame(render);
})();
