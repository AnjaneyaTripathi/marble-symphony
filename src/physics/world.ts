import Matter from 'matter-js';
import type { EmitterObject, MachineObject } from '../model/types';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../model/types';
import { ImpactCooldown } from './cooldown';

export interface Marble { body: Matter.Body; born: number; color: string; radius: number }
export interface Impact { object: MachineObject; strength: number; marble: Marble }
export const STEP_SECONDS = 1 / 120;
export const MAX_MARBLES = 120;
export const MAX_MARBLE_SPEED = 26;
const rad = (degrees: number) => degrees * Math.PI / 180;

/** Runtime bodies never enter the serialized machine document. */
export class PhysicsWorld {
  readonly engine = Matter.Engine.create({ enableSleeping: false, positionIterations: 6, velocityIterations: 6 });
  readonly marbles = new Map<number, Marble>();
  readonly objectBodies = new Map<string, Matter.Body[]>();
  readonly impacts = new ImpactCooldown();
  objects: MachineObject[] = [];
  time = 0;
  private removed = new Set<number>();
  private velocities = new Map<number, Matter.Vector>();
  private bodyObjects = new Map<number, MachineObject>();
  constructor(private onImpact: (impact: Impact) => void = () => {}) {
    this.engine.gravity.y = 1;
    Matter.Events.on(this.engine, 'collisionStart', event => {
      for (const pair of event.pairs) {
        const marble = this.marbles.get(pair.bodyA.id) ?? this.marbles.get(pair.bodyB.id);
        if (!marble) continue;
        const other = marble.body === pair.bodyA ? pair.bodyB : pair.bodyA;
        const object = this.bodyObjects.get(other.id);
        if (!object) continue;
        if (object.type === 'catcher') this.removed.add(marble.body.id);
        if (!['bar', 'bumper', 'catcher'].includes(object.type)) continue;
        const velocity = this.velocities.get(marble.body.id) ?? marble.body.velocity;
        const normal = pair.collision.normal;
        const strength = Math.abs(velocity.x * normal.x + velocity.y * normal.y);
        if (this.impacts.accept(marble.body.id, object.id, this.time, object.type === 'catcher' ? Math.max(0.7, strength) : strength)) this.onImpact({ object, strength, marble });
      }
    });
  }
  setObjects(objects: MachineObject[]) {
    this.reset();
    Matter.Composite.clear(this.engine.world, false);
    Matter.Engine.clear(this.engine);
    this.objects = structuredClone(objects);
    this.objectBodies.clear(); this.bodyObjects.clear();
    const boundary = (x:number) => Matter.Bodies.rectangle(x, WORLD_HEIGHT / 2, 20, WORLD_HEIGHT + 600, { isStatic: true, restitution: 0.3 });
    Matter.Composite.add(this.engine.world, [boundary(-60), boundary(WORLD_WIDTH + 60)]);
    for (const object of objects) {
      const bodies = this.createObject(object);
      this.objectBodies.set(object.id, bodies);
      for (const body of bodies) this.bodyObjects.set(body.id, object);
      Matter.Composite.add(this.engine.world, bodies);
    }
  }
  private createObject(o: MachineObject): Matter.Body[] {
    const a = rad(o.rotation);
    const options = { isStatic: true, angle: a, friction: 0.08, restitution: 0.3 };
    if (o.type === 'bar' || o.type === 'ramp') return [Matter.Bodies.rectangle(o.x, o.y, o.length, o.type === 'bar' ? 16 : 12, { ...options, friction: o.type === 'ramp' ? o.friction : 0.025, restitution: o.bounce })];
    if (o.type === 'bumper') return [Matter.Bodies.circle(o.x, o.y, o.radius, { ...options, restitution: o.bounce, friction: 0.001 })];
    if (o.type === 'catcher') return [Matter.Bodies.rectangle(o.x, o.y, o.width, 30, { ...options, isSensor: true })];
    if (o.type === 'funnel') {
      // Two real sloping walls leave enough clearance for the largest allowed marble.
      const opening = 60, height = 70;
      const segment = (x1:number,y1:number,x2:number,y2:number) => {
        const cx=(x1+x2)/2, cy=(y1+y2)/2;
        return Matter.Bodies.rectangle(o.x+cx*Math.cos(a)-cy*Math.sin(a), o.y+cx*Math.sin(a)+cy*Math.cos(a), Math.hypot(x2-x1,y2-y1), 10, { ...options, angle: a+Math.atan2(y2-y1,x2-x1), friction: 0.015, restitution: 0.08 });
      };
      return [segment(-o.width/2,-height/2,-opening/2,height/2),segment(opening/2,height/2,o.width/2,-height/2)];
    }
    return [];
  }
  emit(emitter: EmitterObject) {
    if (!emitter.enabled || this.marbles.size >= MAX_MARBLES) return false;
    const a = rad(emitter.rotation);
    const radius = emitter.marbleSize;
    const body = Matter.Bodies.circle(emitter.x - Math.sin(a) * 27, emitter.y + Math.cos(a) * 27, radius, { restitution: 0.24, friction: 0.025, frictionAir: 0.0015, density: 0.002 });
    Matter.Body.setVelocity(body, { x: -Math.sin(a) * emitter.speed, y: Math.cos(a) * emitter.speed });
    this.marbles.set(body.id, { body, born: this.time, color: emitter.color, radius });
    Matter.Composite.add(this.engine.world, body);
    return true;
  }
  step(seconds = STEP_SECONDS) {
    for (const [id, marble] of this.marbles) this.velocities.set(id, { ...marble.body.velocity });
    this.time += seconds;
    Matter.Engine.update(this.engine, seconds * 1000);
    for (const [id, marble] of this.marbles) {
      // Energetic bumpers can add energy. Keep travel per fixed step below thin-wall clearance.
      if (marble.body.speed > MAX_MARBLE_SPEED) Matter.Body.setSpeed(marble.body, MAX_MARBLE_SPEED);
      const p = marble.body.position;
      if (this.removed.has(id) || p.y > WORLD_HEIGHT + 250 || p.y < -300 || p.x < -250 || p.x > WORLD_WIDTH + 250 || this.time - marble.born > 45) this.remove(id);
    }
    this.removed.clear();
  }
  private remove(id:number) {
    const marble = this.marbles.get(id);
    if (marble) Matter.Composite.remove(this.engine.world, marble.body);
    this.marbles.delete(id); this.velocities.delete(id); this.impacts.forget(id);
  }
  reset() {
    for (const id of this.marbles.keys()) this.remove(id);
    this.time = 0; this.removed.clear(); this.impacts.clear();
  }
  destroy() { this.reset(); Matter.Events.off(this.engine, 'collisionStart'); Matter.Composite.clear(this.engine.world, false); Matter.Engine.clear(this.engine); }
}
