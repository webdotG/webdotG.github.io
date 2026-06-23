(() => {
  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d');
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  const density = 0.6, speed = 0.6;

  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth*dpr; canvas.height = innerHeight*dpr;
    canvas.style.width = innerWidth+'px'; canvas.style.height = innerHeight+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  addEventListener('resize', resize); resize();

  const P=[], MAX=2400;
  const rand=(a,b)=>a+Math.random()*(b-a);

  function spawn(type, r){
    const x0=r.left, y0=r.top, w=r.width, h=r.height;
    switch(type){
      case 'fire':{
        const n=Math.max(1,Math.round(w/16*density));
        for(let i=0;i<n;i++){
          if(Math.random()>0.5 && n>1) continue;
          P.push({t:'fire',x:x0+Math.random()*w,y:y0+h*rand(.45,.95),
            vx:rand(-12,12),vy:rand(-95,-150),g:-30,life:0,max:rand(.55,1),size:rand(3,7),hue:rand(8,46)});
        }
        break;
      }
      case 'water':{
        const n=Math.max(1,Math.round(w/30*density));
        for(let i=0;i<n;i++){
          if(Math.random()>0.4) continue;
          P.push({t:'drop',x:x0+Math.random()*w,y:y0+h*rand(.7,1),
            vx:rand(-6,6),vy:rand(10,34),g:420,life:0,max:rand(.9,1.5),size:rand(2.4,4.8)});
        }
        if(Math.random()<0.16*density){
          P.push({t:'ripple',x:x0+rand(0,w),y:y0+h+rand(3,12),life:0,max:.7,r0:2,r1:rand(14,26)});
        }
        break;
      }
      case 'wind':{
        const n=Math.max(1,Math.round(h/24*density));
        for(let i=0;i<n;i++){
          if(Math.random()>0.18) continue;
          P.push({t:'wind',x:x0-rand(0,40),y:y0+Math.random()*h,
            vx:rand(220,420),vy:rand(-8,8),g:0,life:0,max:rand(.5,.95),w:rand(16,46)});
        }
        break;
      }
      case 'ghost':{
        if(Math.random()<0.14*density){
          P.push({t:'ghost',x:x0+rand(0,w),y:y0+rand(0,h),baseX:x0+rand(0,w),
            vy:rand(-20,-34),amp:rand(7,18),freq:rand(1.4,2.8),phase:Math.random()*7,
            vx:rand(-10,10),life:0,max:rand(2.2,3.4),size:rand(8,14)});
        }
        break;
      }
    }
  }

  function step(dt){
    const dt2 = dt * speed;
    for(let i=P.length-1;i>=0;i--){
      const p=P[i]; p.life+=dt2;
      if(p.life>=p.max){P.splice(i,1);continue;}
      if(p.t==='ghost'){
        p.baseX+=p.vx*dt2; p.y+=p.vy*dt2;
        p.x=p.baseX+Math.sin(p.life*p.freq+p.phase)*p.amp;
      } else if(p.t!=='ripple'){
        p.vy+=(p.g||0)*dt2; p.x+=p.vx*dt2; p.y+=p.vy*dt2;
      }
    }
    if(P.length>MAX) P.splice(0,P.length-MAX);
  }

  function drawGhost(x,y,s,a){
    ctx.fillStyle=`rgba(246,249,255,${a})`;
    ctx.beginPath();
    ctx.arc(x,y,s,Math.PI,2*Math.PI);
    const by=y+s*1.15, humps=3, stp=(2*s)/humps;
    ctx.lineTo(x+s,by);
    for(let i=0;i<humps;i++){
      const ex=x+s-stp*(i+1);
      const cx=x+s-stp*(i+0.5);
      ctx.quadraticCurveTo(cx, by+(i%2?-s*0.32:s*0.32), ex, by);
    }
    ctx.lineTo(x-s,y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle=`rgba(70,92,124,${a*0.85})`;
    ctx.beginPath(); ctx.arc(x-s*0.34,y+s*0.05,s*0.15,0,7); ctx.fill();
    ctx.beginPath(); ctx.arc(x+s*0.34,y+s*0.05,s*0.15,0,7); ctx.fill();
  }

  function draw(){
    ctx.clearRect(0,0,innerWidth,innerHeight);
    // additive
    ctx.globalCompositeOperation='lighter';
    for(const p of P){
      const k=1-p.life/p.max;
      if(p.t==='fire'){
        ctx.beginPath();
        ctx.fillStyle=`hsla(${p.hue},100%,${55+k*15}%,${k*0.9})`;
        ctx.arc(p.x,p.y,p.size*(0.5+k*0.7),0,7); ctx.fill();
      } else if(p.t==='wind'){
        const a=k*0.5, g=ctx.createLinearGradient(p.x,p.y,p.x+p.w,p.y);
        g.addColorStop(0,'rgba(200,238,255,0)');
        g.addColorStop(.6,`rgba(200,238,255,${a})`);
        g.addColorStop(1,'rgba(200,238,255,0)');
        ctx.strokeStyle=g; ctx.lineWidth=1.4;
        ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x+p.w,p.y); ctx.stroke();
      } else if(p.t==='drop'){
        ctx.fillStyle=`rgba(180,225,255,${Math.min(1,k*1.3)*0.5})`;
        ctx.beginPath(); ctx.ellipse(p.x,p.y,p.size*0.7,p.size*1.2,0,0,7); ctx.fill();
      }
    }
    // normal
    ctx.globalCompositeOperation='source-over';
    for(const p of P){
      const k=1-p.life/p.max;
      if(p.t==='drop'){
        ctx.fillStyle=`rgba(150,210,255,${Math.min(1,k*1.3)})`;
        ctx.beginPath(); ctx.ellipse(p.x,p.y,p.size*0.7,p.size*1.2,0,0,7); ctx.fill();
        ctx.fillStyle=`rgba(255,255,255,${k*0.55})`;
        ctx.beginPath(); ctx.arc(p.x-p.size*0.2,p.y-p.size*0.35,p.size*0.26,0,7); ctx.fill();
      } else if(p.t==='ripple'){
        const t=p.life/p.max, rr=p.r0+(p.r1-p.r0)*t, a=(1-t)*0.5;
        ctx.strokeStyle=`rgba(150,210,255,${a})`; ctx.lineWidth=1.4;
        ctx.beginPath(); ctx.ellipse(p.x,p.y,rr,rr*0.4,0,0,7); ctx.stroke();
      } else if(p.t==='ghost'){
        drawGhost(p.x,p.y,p.size,Math.sin((p.life/p.max)*Math.PI)*0.55);
      }
    }
    ctx.globalCompositeOperation='source-over';
  }

  function emit(){
    document.querySelectorAll('.company_job[data-fx]').forEach(el=>{
      const rc=el.getBoundingClientRect();
      if(rc.bottom<-40 || rc.top>innerHeight+40) return;
      spawn(el.dataset.fx, {left:rc.left, top:rc.top, width:rc.width, height:rc.height});
    });
  }

  let last=performance.now();
  function frame(now){
    let dt=(now-last)/1000; last=now; if(dt>0.05) dt=0.05;
    emit(); step(dt); draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // reveal on scroll (with immediate fallback for above-the-fold)
  const reveals=[...document.querySelectorAll('.reveal_job')];
  function showInView(){
    reveals.forEach(el=>{
      const r=el.getBoundingClientRect();
      if(r.top < innerHeight*0.92) el.classList.add('in_job');
    });
  }
  showInView();
  addEventListener('scroll', showInView, {passive:true});
  // safety: never leave content hidden
  setTimeout(()=>reveals.forEach(el=>el.classList.add('in_job')), 2500);
})();