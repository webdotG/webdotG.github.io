// Each scene defines: vec3 scene(vec2 uv, vec2 px)
// Full frag = HEADER + scene-body + FOOTER

window.VERT = `
attribute vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const HEADER = `
precision highp float;

uniform vec2  u_res;       // device-pixel resolution
uniform float u_time;      // seconds
uniform vec2  u_mouse;     // raw pointer (px, y up)
uniform vec2  u_pointer;   // smoothed pointer (px, y up)  -> the "light"
uniform float u_energy;    // 0..1 interaction energy (decays)

uniform vec3  u_trail[24];   // x,y px ; z birthTime
uniform int   u_trailLen;
uniform vec3  u_ripple[6];   // x,y px ; z birthTime
uniform int   u_rippleLen;

const float TAU = 6.28318530718;

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

float hash21(vec2 p){
  p = fract(p*vec2(123.34, 345.45));
  p += dot(p, p+34.345);
  return fract(p.x*p.y);
}
vec2 hash22(vec2 p){
  p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
  return fract(sin(p)*43758.5453);
}
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  float a=hash21(i), b=hash21(i+vec2(1,0)), c=hash21(i+vec2(0,1)), d=hash21(i+vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float s=0.0, a=0.5;
  mat2 m=mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<5;i++){ s+=a*vnoise(p); p=m*p; a*=0.5; }
  return s;
}

// rainbow cosine palette
vec3 pal(float t){
  return 0.5 + 0.5*cos(TAU*(t + vec3(0.0, 0.33, 0.67)));
}

// ---- interaction fields (resolution independent) ----
float trailField(vec2 px){
  float R = 0.065*u_res.y;
  float s = 0.0;
  for(int i=0;i<24;i++){
    if(i>=u_trailLen) break;
    vec3 t = u_trail[i];
    float life = clamp(1.0 - (u_time - t.z)/1.1, 0.0, 1.0);
    life *= life;
    float d = distance(px, t.xy);
    s += life * exp(-d*d/(2.0*R*R));
  }
  return s;
}
vec2 trailPush(vec2 px){
  float R = 0.10*u_res.y;
  vec2 s = vec2(0.0);
  for(int i=0;i<24;i++){
    if(i>=u_trailLen) break;
    vec3 t = u_trail[i];
    float life = clamp(1.0 - (u_time - t.z)/1.1, 0.0, 1.0);
    vec2 dir = px - t.xy;
    float d = length(dir)+1e-3;
    s += (dir/d) * life * exp(-d*d/(2.0*R*R));
  }
  return s;
}
// expanding wavefront from clicks
float rippleField(vec2 px){
  float sig = 0.045*u_res.y;
  float spd = 0.45*u_res.y;   // px/sec
  float s = 0.0;
  for(int i=0;i<6;i++){
    if(i>=u_rippleLen) break;
    vec3 r = u_ripple[i];
    float age = u_time - r.z;
    if(age < 0.0 || age > 2.4) continue;
    float d = distance(px, r.xy);
    float radius = age*spd;
    float ring = exp(-pow(d-radius,2.0)/(2.0*sig*sig));
    float fade = clamp(1.0 - age/2.4, 0.0, 1.0);
    s += ring * fade * sin((d-radius)*0.06 + age*4.0);
  }
  return s;
}
`;

const FOOTER = `
void main(){
  vec2 px  = gl_FragCoord.xy;
  vec2 uv  = px / u_res;
  vec3 col = scene(uv, px);
  col = clamp(col, 0.0, 1.6);
  // gentle filmic-ish compression + slight saturation lift
  col = col/(1.0+col*0.35);
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------
// LIQUID METAL — iridescent mercury metaballs that gather at the cursor
const METAL = `
float metaField(vec2 p, vec2 lp, float at){
  float f = 0.0;
  for(int i=0;i<5;i++){
    float fi = float(i);
    vec2 c = 0.62*vec2(sin(at*0.7 + fi*1.3), cos(at*0.6 + fi*2.1));
    f += 0.055/(dot(p-c,p-c) + 0.02);
  }
  f += 0.11/(dot(p-lp,p-lp) + 0.012);
  return f;
}
float surf(vec2 px, float at){
  vec2 p  = (px - 0.5*u_res)/u_res.y;
  vec2 lp = (u_pointer - 0.5*u_res)/u_res.y;
  float f = metaField(p, lp, at);
  f += 0.55*trailField(px);
  f += 1.10*rippleField(px);
  return f;
}
vec3 scene(vec2 uv, vec2 px){
  vec2 p  = (px - 0.5*u_res)/u_res.y;
  vec2 lp = (u_pointer - 0.5*u_res)/u_res.y;
  float at = u_time*0.10;            // constant gentle flow

  float d = 2.0;
  float f  = surf(px, at);
  float fx = surf(px + vec2(d,0.0), at) - f;
  float fy = surf(px + vec2(0.0,d), at) - f;
  vec3 n = normalize(vec3(-fx, -fy, 0.45));

  float mask = smoothstep(0.85, 1.15, f);
  vec3 V = vec3(0.0,0.0,1.0);
  vec3 R = reflect(-V, n);
  vec3 L = normalize(vec3(lp - p, 0.9));
  float spec = pow(clamp(dot(R, L), 0.0, 1.0), 28.0);
  float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.0);

  float phase = R.x*1.4 + R.y*1.4 + f*0.4 + fres*1.2;
  vec3 env = pal(phase);
  vec3 bg  = mix(vec3(0.015,0.02,0.045), pal(phase+0.5)*0.18, 0.6);
  vec3 col = mix(bg, env*(0.45 + 0.7*fres), mask);
  col += spec*1.5*mask;
  return col;
}
`;

// ---------------------------------------------------------------------------
// PLASMA FIELD — interfering rainbow waves radiating from the cursor
const PLASMA = `
vec3 scene(vec2 uv, vec2 px){
  vec2 p  = (px - 0.5*u_res)/u_res.y;
  vec2 lp = (u_pointer - 0.5*u_res)/u_res.y;
  float at = u_time*0.06;            // constant gentle flow

  float v = 0.0;
  v += sin(p.x*4.0 + at);
  v += sin(p.y*4.0 + at*1.3);
  v += sin((p.x+p.y)*3.0 + at*0.7);
  v += sin(length(p)*7.0 - at*1.6);

  float dc = distance(p, lp);
  v += 2.2*sin(dc*12.0 - u_time*3.0)/(1.0 + dc*4.0);

  v += 6.0*rippleField(px);
  v += 3.2*trailField(px);

  float phase = v*0.2;
  vec3 col = pal(phase);
  col = pow(col, vec3(1.25));
  col += exp(-dc*dc*3.0)*0.3*pal(phase+0.4);
  return col;
}
`;

// ---------------------------------------------------------------------------
// CRYSTAL — faceted voronoi gem, cells light up around the cursor
const CRYSTAL = `
float voro(vec2 x, float at, out vec2 id){
  vec2 n=floor(x), f=fract(x);
  vec2 mg, mr; float md=8.0;
  for(int j=-1;j<=1;j++)
  for(int i=-1;i<=1;i++){
    vec2 g=vec2(float(i),float(j));
    vec2 o=hash22(n+g);
    o=0.5+0.4*sin(at + TAU*o);
    vec2 r=g+o-f;
    float d=dot(r,r);
    if(d<md){ md=d; mr=r; mg=g; }
  }
  md=8.0;
  for(int j=-2;j<=2;j++)
  for(int i=-2;i<=2;i++){
    vec2 g=mg+vec2(float(i),float(j));
    vec2 o=hash22(n+g);
    o=0.5+0.4*sin(at + TAU*o);
    vec2 r=g+o-f;
    vec2 diff=r-mr;
    if(dot(diff,diff)>1e-4)
      md=min(md, dot(0.5*(mr+r), normalize(diff)));
  }
  id = n+mg;
  return md; // edge distance
}
vec3 scene(vec2 uv, vec2 px){
  vec2 p  = (px - 0.5*u_res)/u_res.y;
  vec2 lp = (u_pointer - 0.5*u_res)/u_res.y;
  float at = u_time*0.05;            // constant gentle flow

  vec2 id;
  float edge = voro(p*4.0, at, id);
  float rnd  = hash21(id);

  float phase = rnd*3.0 + at*0.15 + length(p-lp)*0.5;
  vec3 col = pal(phase);

  float dl = distance(p, lp);
  float lit = exp(-dl*dl*2.2)*(0.5 + 0.5*sin(rnd*30.0));
  col *= 0.45 + 0.55*lit + 0.35;

  float e = smoothstep(0.0, 0.045, edge);
  col = mix(pal(phase+0.4)*1.6, col, e);

  col += 0.55*trailField(px)*pal(phase+0.2);
  col += rippleField(px)*pal(phase+0.5);
  return col;
}
`;

window.SHADERS = [
  { id:'metal',   name:'Live', hint:'mercury metaballs', frag: HEADER + METAL   + FOOTER },
  { id:'plasma',  name:'Benzin', hint:'rainbow waves',     frag: HEADER + PLASMA  + FOOTER },
];
