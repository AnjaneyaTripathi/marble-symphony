import type { MachineDocument, MachineObject, MusicSettings, ObjectType } from '../model/types';
import { createObject } from '../model/defaults';

const music:MusicSettings={bpm:96,root:0,scale:'pentatonic',masterVolume:.55,muted:false,snapNotes:false,snapDivision:'eighth'};
let serial=0;
function object(type:ObjectType,x:number,y:number,properties:Record<string,unknown>={}):MachineObject {
  return {...createObject(type,x,y),id:`preset-${++serial}`,...properties} as MachineObject;
}
const text=(x:number,y:number,label:string,size=20)=>object('text',x,y,{text:label,fontSize:size,color:'#839082'});
const bar=(x:number,y:number,length:number,rotation:number,note:number,color:string,voice='marimba')=>object('bar',x,y,{length,rotation,note,color,voice,bounce:.42,volume:.65});
const ramp=(x:number,y:number,length:number,rotation:number)=>object('ramp',x,y,{length,rotation,friction:.025,bounce:.1,color:'#97a596'});
const emitter=(x:number,y:number,properties:Record<string,unknown>={})=>object('emitter',x,y,{...properties});
function document(name:string,objects:MachineObject[],settings:Partial<MusicSettings>={}):MachineDocument {
  return {version:1,name,music:{...music,...settings},objects,editor:{gridSnap:true}};
}

const firstMelody=document('First Melody',[
  text(270,90,'let gravity play',22),
  emitter(400,85,{division:'quarter',color:'#d99a48'}),
  bar(435,215,280,18,60,'#df998c'),
  bar(605,355,300,-18,64,'#e0bd68'),
  bar(440,495,300,18,67,'#91ad96'),
  bar(605,635,300,-18,72,'#93adc7'),
  object('funnel',450,740,{width:220,color:'#c69b67'}),
  object('catcher',450,820,{width:240,musical:true,note:48,voice:'warm',volume:.42,color:'#91a798'}),
  text(840,110,'a little counterpoint',19),
  emitter(850,175,{division:'quarter',beatOffset:.5,color:'#92b0b1'}),
  bar(865,325,190,12,79,'#b7aecb','bell'),
  object('bumper',965,525,{radius:32,bounce:.85,musical:true,note:76,voice:'bell',volume:.3,color:'#d5b874'}),
  ramp(930,675,230,-20),
  object('catcher',845,815,{width:260,color:'#91a798'}),
  text(750,460,'follow the falling notes',16),
  text(255,710,'C · E · G · C',19),
]);

const bellGarden=document('Bell Garden',[
  text(600,75,'room for the echoes',27),
  emitter(310,125,{division:'quarter',color:'#bea9cd'}),
  emitter(820,125,{division:'quarter',beatOffset:.5,color:'#b6bfb0'}),
  bar(340,300,240,17,72,'#bbaed2','bell'),
  bar(785,355,260,-17,79,'#a6bac8','bell'),
  object('bumper',475,490,{radius:38,bounce:.45,musical:true,note:76,voice:'bell',volume:.38,color:'#d7b36f'}),
  object('bumper',560,455,{radius:34,bounce:.5,musical:true,note:74,voice:'bell',volume:.32,color:'#a0b49d'}),
  ramp(330,605,230,19),ramp(800,650,230,-19),
  object('funnel',500,735,{width:260,color:'#c8ad85'}),
  object('catcher',500,825,{width:280,color:'#9daf9d'}),
  object('catcher',810,825,{width:220,color:'#9daf9d'}),
  text(600,205,'breathe in, listen out',17),
  text(240,485,'softly',19),text(910,555,'slowly',19),
],{bpm:48,masterVolume:.48});

const percussionPlayground=document('Percussion Playground',[
  text(600,65,'a happy little racket',27),
  emitter(360,120,{division:'eighth',speed:3,rotation:-15,color:'#df9d57'}),
  emitter(820,120,{division:'sixteenth',beatOffset:.25,speed:2,rotation:15,marbleSize:8,color:'#8eafba'}),
  ramp(310,230,200,20),ramp(875,230,200,-20),
  object('bumper',450,350,{radius:44,bounce:1.12,musical:true,note:48,voice:'marimba',volume:.6,color:'#df998c'}),
  object('bumper',730,350,{radius:44,bounce:1.05,musical:true,note:55,voice:'marimba',volume:.6,color:'#dfbe70'}),
  object('bumper',600,455,{radius:40,bounce:1.1,musical:true,note:60,voice:'warm',volume:.5,color:'#92b097'}),
  object('bumper',470,550,{radius:30,bounce:.65,musical:true,note:50,voice:'marimba',volume:.55,color:'#9fabc8'}),
  object('bumper',685,550,{radius:30,bounce:.65,musical:true,note:57,voice:'marimba',volume:.55,color:'#c1a9cc'}),
  bar(460,655,190,14,64,'#d9ae82'),bar(760,655,190,-14,67,'#9bb9b8'),
  object('funnel',610,760,{width:350,color:'#c8a574'}),
  object('catcher',610,840,{width:420,color:'#94a793'}),
  text(200,410,'tap',24),text(980,420,'bounce',24),text(600,265,'two rhythms. endless possibilities.',17),
],{bpm:92,masterVolume:.45});

export const presets=[
  {id:'first-melody',name:'First Melody',description:'A four-note cascade with a bright little counterpoint.',document:firstMelody},
  {id:'bell-garden',name:'Bell Garden',description:'Slow, spacious bells and soft, rounded landings.',document:bellGarden},
  {id:'percussion-playground',name:'Percussion Playground',description:'Interlocking rhythms in a playful bumper garden.',document:percussionPlayground},
];
export function blankDocument():MachineDocument{return document('Untitled machine',[]);}
