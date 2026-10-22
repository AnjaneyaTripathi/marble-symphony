import type { EmitterObject, MachineDocument, MachineObject, ObjectType, Voice } from '../model/types';
import { OBJECT_TYPES } from '../model/types';
import { PhysicsWorld, STEP_SECONDS } from '../physics/world';
import type { Impact } from '../physics/world';
import { Synth } from '../audio/Synth';
import { Transport } from '../audio/Transport';
import type { EmissionEvent } from '../audio/Transport';
import { hitTest, objectSize, render, rotationHandle } from '../canvas/renderer';
import type { Camera, Pulse } from '../canvas/renderer';

// Keep ordinary low-refresh frames in real time while putting a firm upper bound
// on work after a suspended tab or debugger pause.  This is deliberately shared
// by the accumulator cap and loop limit: a 100 ms frame gets its full 12 fixed
// steps, while a longer stall is discarded instead of becoming an emission burst.
export const MAX_FRAME_DELTA_SECONDS = 0.1;
export const MAX_CATCH_UP_STEPS = 12;
export const MAX_ACCUMULATED_SECONDS = STEP_SECONDS * MAX_CATCH_UP_STEPS;

export interface RuntimeStatus { playing:boolean; marbles:number; notes:number; beat:number; audioReady:boolean; zoom:number }
export interface NoteActivity { note:number; voice:Voice; color:string; id:string }
export interface RuntimeCallbacks {
  onEdit(objects:MachineObject[]):void;
  onSelect(id:string|null):void;
  onPlace(type:ObjectType,x:number,y:number):void;
  onStatus(status:RuntimeStatus):void;
  onHint(message:string):void;
  onNote(event:NoteActivity):void;
}
interface EditorState { selectedId:string|null; placement:ObjectType|null; gridSnap:boolean; panMode:boolean }
interface Drag { id:string; mode:'move'|'rotate'; start:{x:number;y:number}; original:MachineObject[]; object:MachineObject; changed:boolean }
interface ScheduledActivity { time:number; pulse:Pulse; note?:NoteActivity }

/** Imperative simulation and pointer controller; React only sees throttled status/design commits. */
export class MarbleRuntime {
  readonly physics:PhysicsWorld;
  private synth = new Synth();
  private transport = new Transport();
  private doc:MachineDocument|null=null;
  private objects:MachineObject[]=[];
  private objectSignature='';
  private editor:EditorState={selectedId:null,placement:null,gridSnap:true,panMode:false};
  private camera:Camera={x:0,y:0,zoom:1};
  private context:CanvasRenderingContext2D;
  private width=0;private height=0;private dpr=1;
  private observer:ResizeObserver;
  private abort=new AbortController();
  private frame=0;private previous=0;private accumulator=0;private lastStatus=0;
  private playing=false;private notes=0;private generation=0;private starting=false;private destroyed=false;
  private releases:EmissionEvent[]=[];private activities:ScheduledActivity[]=[];private pulses:Pulse[]=[];
  private pointer:{x:number;y:number}|null=null;
  private drag:Drag|null=null;
  private pan:{x:number;y:number;camera:Camera}|null=null;
  private pointers=new Map<number,{x:number;y:number}>();
  private pinch:{distance:number;zoom:number;world:{x:number;y:number}}|null=null;
  private reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private canvas:HTMLCanvasElement,private callbacks:RuntimeCallbacks) {
    const context=canvas.getContext('2d');if(!context)throw new Error('This browser could not create a canvas.');this.context=context;
    this.physics=new PhysicsWorld(impact=>this.impact(impact));
    canvas.dataset.testid='simulation-canvas';canvas.setAttribute('aria-label','Marble machine canvas. Select objects in the object list to edit using the keyboard.');
    canvas.style.touchAction='none';
    const options={signal:this.abort.signal};
    canvas.addEventListener('pointerdown',this.pointerDown,options);
    canvas.addEventListener('pointermove',this.pointerMove,options);
    canvas.addEventListener('pointerup',this.pointerUp,options);
    canvas.addEventListener('pointercancel',this.pointerCancel,options);
    canvas.addEventListener('pointerleave',()=>{if(!this.pointers.size)this.pointer=null;},options);
    canvas.addEventListener('wheel',this.wheel,{...options,passive:false});
    canvas.addEventListener('contextmenu',event=>event.preventDefault(),options);
    canvas.addEventListener('dragover',event=>{event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';},options);
    canvas.addEventListener('drop',event=>{event.preventDefault();const type=event.dataTransfer?.getData('application/x-marble-object') as ObjectType;if(OBJECT_TYPES.includes(type)){this.beforeEdit();const p=this.toWorld(event.clientX,event.clientY);this.callbacks.onPlace(type,this.snapX(p.x),this.snapY(p.y));}},options);
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&(this.playing||this.starting)){this.pause();this.callbacks.onHint('Music paused while this tab was hidden. Press play to resume.');}},options);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);
    this.resize();this.frame=requestAnimationFrame(this.tick);
  }
  setDocument(doc:MachineDocument) {
    const firstDocument=this.doc===null;
    const signature=JSON.stringify(doc.objects),geometryChanged=signature!==this.objectSignature;
    if(geometryChanged){
      if(this.playing)this.beforeEdit();
      this.drag=null;
      this.objects=structuredClone(doc.objects);this.objectSignature=signature;this.physics.setObjects(this.objects);this.activities=[];this.pulses=[];this.notes=0;
    }
    if(this.doc?.music.bpm!==doc.music.bpm)this.releases=[];
    this.doc=doc;this.synth.setSettings(doc.music);this.transport.setSettings(doc.music);
    if(firstDocument&&this.width>0)this.fit();
    this.status();
  }
  setEditor(editor:EditorState){this.editor={...editor};this.canvas.style.cursor=editor.panMode?'grab':editor.placement?'crosshair':'default';}
  getStatus():RuntimeStatus{return{playing:this.playing,marbles:this.physics.marbles.size,notes:this.notes,beat:this.playing?this.transport.getBeat(this.synth.currentTime):0,audioReady:this.synth.ready,zoom:this.camera.zoom};}
  async start() {
    if(this.playing||this.starting||!this.doc)return;
    const generation=++this.generation;this.starting=true;
    try{await this.synth.initialize();}catch{this.callbacks.onHint('Audio is unavailable. The marble machine still works visually. Check browser sound permissions and try play again.');}
    this.starting=false;
    if(generation!==this.generation||this.destroyed)return;
    this.playing=true;this.accumulator=0;this.previous=performance.now();this.releases=[];this.activities=[];this.pulses=[];this.transport.start(this.synth.currentTime);this.status();
  }
  pause(){this.generation++;this.starting=false;this.playing=false;this.accumulator=0;this.releases=[];this.activities=[];this.transport.pause();this.synth.silence();this.status();}
  reset(){this.pause();this.physics.reset();this.notes=0;this.pulses=[];this.transport.reset();this.status();}
  async step(){
    if(this.destroyed)return;
    if(this.playing||this.starting)this.pause();
    const generation=++this.generation;
    try{await this.synth.initialize();}catch{/* The visual single step remains available. */}
    if(generation!==this.generation||this.destroyed)return;
    const seeded=!this.physics.marbles.size;
    if(seeded)for(const emitter of this.emitters())this.physics.emit(emitter);
    this.physics.step();this.flushActivities(this.synth.currentTime);this.status();
    this.callbacks.onHint(seeded?'Released one marble per enabled emitter; advanced 1/120 second. Beat offsets apply during playback.':'Advanced the machine by 1/120 second.');
  }
  fit(){
    if(!this.width||!this.height)return;
    let left=0,top=0,right=1200,bottom=850;
    if(this.objects.length){
      left=Infinity;top=Infinity;right=-Infinity;bottom=-Infinity;
      for(const o of this.objects){
        const size=objectSize(o),angle=o.rotation*Math.PI/180;
        const rx=(Math.abs(Math.cos(angle))*size.width+Math.abs(Math.sin(angle))*size.height)/2;
        const ry=(Math.abs(Math.sin(angle))*size.width+Math.abs(Math.cos(angle))*size.height)/2;
        left=Math.min(left,o.x-rx-55);right=Math.max(right,o.x+rx+55);
        top=Math.min(top,o.y-ry-45);bottom=Math.max(bottom,o.y+ry+65);
      }
      if(right-left<650){const center=(left+right)/2;left=center-325;right=center+325;}
      if(bottom-top<490){const center=(top+bottom)/2;top=center-245;bottom=center+245;}
    }
    const zoom=Math.max(.2,Math.min(2,Math.min((this.width-36)/(right-left),(this.height-36)/(bottom-top))));
    this.camera={zoom,x:this.width/2-(left+right)/2*zoom,y:this.height/2-(top+bottom)/2*zoom};this.status();
  }
  zoomBy(factor:number){this.zoomAt(this.width/2,this.height/2,this.camera.zoom*factor);}
  cancelInteraction(){if(this.drag)this.objects=this.drag.original;this.drag=null;this.pan=null;this.pinch=null;}
  destroy(){this.destroyed=true;cancelAnimationFrame(this.frame);this.abort.abort();this.observer.disconnect();this.synth.dispose();this.physics.destroy();}
  private emitters(){return this.objects.filter((o):o is EmitterObject=>o.type==='emitter');}
  private impact({object,strength}:Impact){
    const musical=object.type==='bar'||((object.type==='bumper'||object.type==='catcher')&&object.musical);
    const now=this.synth.currentTime;
    const time=musical&&this.doc?this.transport.noteTime(now,this.doc.music):now;
    const pulse={id:object.id,color:object.color,time};
    if(musical&&(object.type==='bar'||object.type==='bumper'||object.type==='catcher')){
      this.synth.play(object.note,object.voice,object.volume,Math.max(.16,Math.min(1,strength/7)),time);
      this.activities.push({time,pulse,note:{note:object.note,voice:object.voice,color:object.color,id:object.id}});
    }else this.activities.push({time,pulse});
    if(this.activities.length>512)this.activities.splice(0,this.activities.length-512);
  }
  private flushActivities(now:number){
    const remaining:ScheduledActivity[]=[];
    for(const activity of this.activities){if(activity.time<=now+.002){this.pulses.push(activity.pulse);if(activity.note){this.notes++;this.callbacks.onNote(activity.note);}}else remaining.push(activity);}
    this.activities=remaining;this.pulses=this.pulses.filter(p=>now-p.time<.45).slice(-100);
  }
  private tick=(timestamp:number)=>{
    if(this.destroyed)return;
    const delta=this.previous?Math.min(MAX_FRAME_DELTA_SECONDS,Math.max(0,(timestamp-this.previous)/1000)):0;this.previous=timestamp;
    const now=this.synth.currentTime;
    if(this.playing){
      this.releases.push(...this.transport.poll(now,this.emitters()));
      this.releases=this.releases.filter(event=>event.time>=now-.12);
      this.accumulator=Math.min(this.accumulator+delta,MAX_ACCUMULATED_SECONDS);
      let steps=0;
      while(this.accumulator>=STEP_SECONDS&&steps<MAX_CATCH_UP_STEPS){
        const stepTime=now-this.accumulator+STEP_SECONDS;
        const pending:EmissionEvent[]=[];
        for(const event of this.releases){if(event.time<=stepTime){const emitter=this.objects.find(o=>o.id===event.emitterId&&o.type==='emitter') as EmitterObject|undefined;if(emitter)this.physics.emit(emitter);}else pending.push(event);}
        this.releases=pending;this.physics.step();this.accumulator-=STEP_SECONDS;steps++;
      }
    }
    this.flushActivities(now);
    render(this.context,this.width,this.height,this.dpr,{objects:this.objects,marbles:this.physics.marbles.values(),selectedId:this.editor.selectedId,pulses:this.pulses,now,camera:this.camera,placement:this.editor.placement,pointer:this.pointer,reducedMotion:this.reducedMotion});
    if(timestamp-this.lastStatus>100){this.lastStatus=timestamp;this.status();}
    this.frame=requestAnimationFrame(this.tick);
  };
  private status(){const status=this.getStatus();this.canvas.dataset.marbles=String(status.marbles);this.canvas.dataset.notes=String(status.notes);this.canvas.dataset.playing=String(status.playing);this.canvas.dataset.audioReady=String(status.audioReady);this.callbacks.onStatus(status);}
  private resize(){const box=this.canvas.getBoundingClientRect();const initial=!this.width;this.width=box.width;this.height=box.height;this.dpr=Math.min(window.devicePixelRatio||1,2.5);this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);if(initial)this.fit();}
  private toWorld(clientX:number,clientY:number){const rect=this.canvas.getBoundingClientRect();return{x:(clientX-rect.left-this.camera.x)/this.camera.zoom,y:(clientY-rect.top-this.camera.y)/this.camera.zoom};}
  private snap(value:number){return this.editor.gridSnap?Math.round(value/25)*25:Math.round(value);}
  private snapX(value:number){return Math.max(-200,Math.min(1400,this.snap(value)));}
  private snapY(value:number){return Math.max(-200,Math.min(1050,this.snap(value)));}
  private beforeEdit(){if(this.playing||this.starting){this.pause();this.callbacks.onHint('Paused for editing. Press play to hear your changes.');}}
  private zoomAt(x:number,y:number,zoom:number){const next=Math.max(.2,Math.min(3,zoom)),factor=next/this.camera.zoom;this.camera={x:x-(x-this.camera.x)*factor,y:y-(y-this.camera.y)*factor,zoom:next};this.status();}
  private wheel=(event:WheelEvent)=>{event.preventDefault();const rect=this.canvas.getBoundingClientRect();this.zoomAt(event.clientX-rect.left,event.clientY-rect.top,this.camera.zoom*Math.exp(-event.deltaY*.0015));};
  private pointerDown=(event:PointerEvent)=>{
    if(event.button!==0&&event.button!==1)return;
    this.canvas.setPointerCapture(event.pointerId);this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(this.pointers.size===2){this.cancelInteraction();const [a,b]=[...this.pointers.values()];this.pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:this.camera.zoom,world:this.toWorld((a.x+b.x)/2,(a.y+b.y)/2)};return;}
    const p=this.toWorld(event.clientX,event.clientY);this.pointer=p;
    if(event.button===1||this.editor.panMode){this.pan={x:event.clientX,y:event.clientY,camera:{...this.camera}};this.canvas.style.cursor='grabbing';return;}
    if(this.editor.placement){this.beforeEdit();this.callbacks.onPlace(this.editor.placement,this.snapX(p.x),this.snapY(p.y));return;}
    const selected=this.objects.find(o=>o.id===this.editor.selectedId),handle=selected?rotationHandle(selected):null;
    const rotating=selected&&handle&&Math.hypot(p.x-handle.x,p.y-handle.y)<16/this.camera.zoom;
    const target=rotating?selected:hitTest(this.objects,p.x,p.y);
    this.callbacks.onSelect(target?.id??null);
    if(target)this.drag={id:target.id,mode:rotating?'rotate':'move',start:p,original:structuredClone(this.objects),object:structuredClone(target),changed:false};
  };
  private pointerMove=(event:PointerEvent)=>{
    const p=this.toWorld(event.clientX,event.clientY);this.pointer=p;
    if(this.pointers.has(event.pointerId))this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(this.pinch&&this.pointers.size===2){const [a,b]=[...this.pointers.values()],rect=this.canvas.getBoundingClientRect(),zoom=Math.max(.2,Math.min(3,this.pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,this.pinch.distance)));this.camera={zoom,x:(a.x+b.x)/2-rect.left-this.pinch.world.x*zoom,y:(a.y+b.y)/2-rect.top-this.pinch.world.y*zoom};return;}
    if(this.pan){this.camera={...this.pan.camera,x:this.pan.camera.x+event.clientX-this.pan.x,y:this.pan.camera.y+event.clientY-this.pan.y};return;}
    if(!this.drag)return;
    const drag=this.drag;
    if(!drag.changed&&Math.hypot(p.x-drag.start.x,p.y-drag.start.y)*this.camera.zoom<3)return;
    if(!drag.changed)this.beforeEdit();drag.changed=true;
    this.objects=this.objects.map(o=>o.id!==drag.id?o:drag.mode==='move'?{...o,x:Math.max(-200,Math.min(1400,this.snap(drag.object.x+p.x-drag.start.x))),y:Math.max(-200,Math.min(1050,this.snap(drag.object.y+p.y-drag.start.y)))}:{...o,rotation:this.editor.gridSnap?Math.round((Math.atan2(p.y-o.y,p.x-o.x)*180/Math.PI+90)/15)*15:Math.round(Math.atan2(p.y-o.y,p.x-o.x)*180/Math.PI+90)});
  };
  private pointerUp=(event:PointerEvent)=>{this.pointers.delete(event.pointerId);if(this.pinch){this.pinch=null;this.pan=null;return;}if(this.drag?.changed){this.physics.setObjects(this.objects);this.callbacks.onEdit(structuredClone(this.objects));}this.drag=null;this.pan=null;this.canvas.style.cursor=this.editor.panMode?'grab':this.editor.placement?'crosshair':'default';};
  private pointerCancel=(event:PointerEvent)=>{this.pointers.delete(event.pointerId);this.cancelInteraction();};
}
