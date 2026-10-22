import type { MachineObject, ObjectType } from '../model/types';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../model/types';
import type { Marble } from '../physics/world';
import { noteName } from '../audio/music';

export interface Camera { x:number; y:number; zoom:number }
export interface Pulse { id:string; time:number; color:string }
export const objectSize = (o: MachineObject): {width:number;height:number} => {
  switch(o.type) {
    case 'ramp': return {width:o.length,height:12};
    case 'bar': return {width:o.length,height:22};
    case 'bumper': return {width:o.radius*2,height:o.radius*2};
    case 'funnel': return {width:o.width,height:90};
    case 'catcher': return {width:o.width,height:40};
    case 'text': return {width:Math.max(40,o.text.length*o.fontSize*.58),height:o.fontSize*1.3};
    default:return {width:50,height:58};
  }
};
export function localPoint(o:MachineObject,x:number,y:number) {
  const a=-o.rotation*Math.PI/180, dx=x-o.x, dy=y-o.y;
  return {x:dx*Math.cos(a)-dy*Math.sin(a),y:dx*Math.sin(a)+dy*Math.cos(a)};
}
export function hitTest(objects:MachineObject[],x:number,y:number):MachineObject|undefined {
  return [...objects].reverse().find(o=>{
    const p=localPoint(o,x,y),s=objectSize(o);
    return Math.abs(p.x)<s.width/2+10 && Math.abs(p.y)<s.height/2+10;
  });
}
export function rotationHandle(o:MachineObject) {
  const a=o.rotation*Math.PI/180,d=objectSize(o).height/2+35;
  return {x:o.x+Math.sin(a)*d,y:o.y-Math.cos(a)*d};
}
const rounded=(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r=6)=>{c.beginPath();c.roundRect(x,y,w,h,r);};
function bolt(c:CanvasRenderingContext2D,x:number,y:number) {
  c.fillStyle='rgba(40,48,44,.25)';c.beginPath();c.arc(x,y,3,0,Math.PI*2);c.fill();
  c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=1;c.beginPath();c.moveTo(x-1.7,y);c.lineTo(x+1.7,y);c.stroke();
}
function object(c:CanvasRenderingContext2D,o:MachineObject,pulse:number) {
  c.save();c.translate(o.x,o.y);c.rotate(o.rotation*Math.PI/180);
  c.fillStyle=o.color;c.strokeStyle='#34443c';c.lineWidth=2;
  c.shadowColor='rgba(40,48,44,.09)';c.shadowBlur=6;c.shadowOffsetY=4;
  if(pulse>0){c.shadowColor=o.color;c.shadowBlur=14+pulse*15;}
  if(o.type==='ramp') {
    c.fillStyle=o.color;rounded(c,-o.length/2,-6,o.length,12,5);c.fill();c.shadowBlur=0;c.stroke();
    c.strokeStyle='rgba(255,255,255,.6)';c.beginPath();c.moveTo(-o.length/2+7,-3);c.lineTo(o.length/2-7,-3);c.stroke();
    bolt(c,-o.length/2+12,0);bolt(c,o.length/2-12,0);
  } else if(o.type==='bar') {
    rounded(c,-o.length/2,-9,o.length,18,7);c.fill();c.shadowBlur=0;c.strokeStyle='rgba(43,57,48,.25)';c.stroke();
    c.fillStyle='rgba(255,255,255,.35)';rounded(c,-o.length/2+2,-7,o.length-4,5,3);c.fill();
    bolt(c,-o.length/2+12,0);bolt(c,o.length/2-12,0);
    c.fillStyle='#34443c';c.font='600 12px system-ui';c.textAlign='center';c.fillText(noteName(o.note),0,4);
  } else if(o.type==='bumper') {
    c.beginPath();c.arc(0,0,o.radius,0,Math.PI*2);c.fill();c.shadowBlur=0;c.strokeStyle='rgba(43,57,48,.35)';c.stroke();
    c.beginPath();c.arc(0,0,Math.max(3,o.radius-7),0,Math.PI*2);c.strokeStyle='rgba(255,255,255,.65)';c.stroke();
    c.fillStyle='#34443c';c.textAlign='center';c.font='600 12px system-ui';c.fillText(o.musical?noteName(o.note):'✦',0,4);
    if(pulse>0){c.globalAlpha=pulse*.6;c.beginPath();c.arc(0,0,o.radius+(1-pulse)*22,0,Math.PI*2);c.strokeStyle=o.color;c.lineWidth=3;c.stroke();}
  } else if(o.type==='funnel') {
    c.lineWidth=10;c.strokeStyle=o.color;c.lineCap='round';c.beginPath();c.moveTo(-o.width/2,-35);c.lineTo(-30,35);c.moveTo(30,35);c.lineTo(o.width/2,-35);c.stroke();
    c.shadowBlur=0;c.lineWidth=2;c.strokeStyle='rgba(52,68,60,.4)';c.stroke();
    bolt(c,-o.width/2,-35);bolt(c,o.width/2,-35);
  } else if(o.type==='catcher') {
    c.beginPath();c.moveTo(-o.width/2,-15);c.lineTo(-o.width/2+12,19);c.lineTo(o.width/2-12,19);c.lineTo(o.width/2,-15);c.closePath();c.fill();c.shadowBlur=0;c.stroke();
    c.strokeStyle='rgba(255,255,255,.45)';c.lineWidth=2;for(let x=-o.width/2+18;x<o.width/2-10;x+=12){c.beginPath();c.moveTo(x,-9);c.lineTo(x+3,13);c.stroke();}
  } else if(o.type==='emitter') {
    c.fillStyle='#f9f7ef';rounded(c,-23,-24,46,48,13);c.fill();c.stroke();c.shadowBlur=0;
    c.fillStyle=o.color;c.beginPath();c.arc(-6,-7,7,0,Math.PI*2);c.fill();c.beginPath();c.arc(8,4,7,0,Math.PI*2);c.fill();
    c.fillStyle='#34443c';rounded(c,-10,18,20,13,4);c.fill();
    if(!o.enabled){c.strokeStyle='#b96557';c.beginPath();c.moveTo(-18,-20);c.lineTo(18,20);c.stroke();}
  } else {
    c.shadowBlur=0;c.fillStyle=o.color;c.font=`500 ${o.fontSize}px Georgia, serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(o.text,0,0);
  }
  if(pulse>0 && o.type==='bar'){c.globalAlpha=pulse*.4;c.fillStyle='#fff';rounded(c,-o.length/2,-9,o.length,18,7);c.fill();}
  c.restore();
}
export interface RenderState { objects:MachineObject[]; marbles:Iterable<Marble>; selectedId:string|null; pulses:Pulse[]; now:number; camera:Camera; placement:ObjectType|null; pointer:{x:number;y:number}|null; reducedMotion:boolean }
export function render(c:CanvasRenderingContext2D,width:number,height:number,dpr:number,state:RenderState) {
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);c.fillStyle='#f6f5ed';c.fillRect(0,0,width,height);
  const {camera}=state;c.translate(camera.x,camera.y);c.scale(camera.zoom,camera.zoom);
  const left=-camera.x/camera.zoom,top=-camera.y/camera.zoom,right=(width-camera.x)/camera.zoom,bottom=(height-camera.y)/camera.zoom;
  const grid=camera.zoom<.4?100:camera.zoom<.7?50:25;
  c.fillStyle='#d8ddd3';for(let x=Math.ceil(left/grid)*grid;x<right;x+=grid)for(let y=Math.ceil(top/grid)*grid;y<bottom;y+=grid){c.beginPath();c.arc(x,y,.85,0,Math.PI*2);c.fill();}
  c.strokeStyle='rgba(65,79,65,.13)';c.lineWidth=1/camera.zoom;c.setLineDash([5,8]);rounded(c,0,0,WORLD_WIDTH,WORLD_HEIGHT,12);c.stroke();c.setLineDash([]);
  c.font='10px system-ui';c.fillStyle='#8d978b';c.fillText('MARBLE FIELD',14,WORLD_HEIGHT-14);
  const pulseMap=new Map<string,number>();for(const p of state.pulses)pulseMap.set(p.id,Math.max(pulseMap.get(p.id)??0,Math.max(0,1-(state.now-p.time)/.4)));
  for(const o of state.objects)object(c,o,state.reducedMotion?0:pulseMap.get(o.id)??0);
  for(const marble of state.marbles){
    const p=marble.body.position,r=marble.radius;c.save();c.translate(p.x,p.y);c.shadowColor='rgba(35,50,41,.17)';c.shadowBlur=4;c.shadowOffsetY=3;c.fillStyle=marble.color;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fill();c.shadowBlur=0;c.strokeStyle='rgba(42,54,45,.25)';c.lineWidth=1;c.stroke();c.fillStyle='rgba(255,255,255,.65)';c.beginPath();c.ellipse(-r*.28,-r*.32,r*.28,r*.18,-.5,0,Math.PI*2);c.fill();c.restore();
  }
  const selected=state.objects.find(o=>o.id===state.selectedId);
  if(selected){
    const s=objectSize(selected);c.save();c.translate(selected.x,selected.y);c.rotate(selected.rotation*Math.PI/180);c.strokeStyle='#344f40';c.lineWidth=1.6/camera.zoom;c.setLineDash([4/camera.zoom,3/camera.zoom]);rounded(c,-s.width/2-8,-s.height/2-8,s.width+16,s.height+16,6);c.stroke();c.setLineDash([]);c.beginPath();c.moveTo(0,-s.height/2-8);c.lineTo(0,-s.height/2-35);c.stroke();c.fillStyle='#fff';c.beginPath();c.arc(0,-s.height/2-35,7/camera.zoom,0,Math.PI*2);c.fill();c.stroke();c.restore();
  }
  if(state.placement&&state.pointer){c.strokeStyle='#344f40';c.lineWidth=1.5/camera.zoom;c.beginPath();c.arc(state.pointer.x,state.pointer.y,20,0,Math.PI*2);c.moveTo(state.pointer.x-26,state.pointer.y);c.lineTo(state.pointer.x+26,state.pointer.y);c.moveTo(state.pointer.x,state.pointer.y-26);c.lineTo(state.pointer.x,state.pointer.y+26);c.stroke();}
}
