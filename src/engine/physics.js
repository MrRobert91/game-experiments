import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export { RAPIER };

// collision groups
export const G = { WORLD: 1, ROBOT: 2, PROP: 4, BOSS: 8, DEBRIS: 16 };
const ALL = 0xffff;
export const groups = (member, filter = ALL) => ((member & 0xffff) << 16) | (filter & 0xffff);
export const GROUPS = {
  world: groups(G.WORLD),
  robot: groups(G.ROBOT, ALL & ~G.ROBOT),
  prop: groups(G.PROP),
  boss: groups(G.BOSS, ALL & ~G.BOSS),
  debris: groups(G.DEBRIS, G.WORLD | G.PROP | G.DEBRIS),
  fall: groups(G.DEBRIS, G.WORLD), // big falling set pieces: only hit the static world, never each other
};

export const STEP = 1 / 60;

export class Physics {
  static async create() {
    await RAPIER.init();
    return new Physics();
  }

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -22, z: 0 });
    this.world.timestep = STEP;
    this.events = new RAPIER.EventQueue(true);
    this.entities = new Set();
    this.acc = 0;
    this.alpha = 1;
    this.onImpact = null; // (entity, force, point)
    this.byCollider = new Map();
  }

  /**
   * Create a rigid body + colliders bound to a three object.
   * shapes: [{ kind:'box'|'ball'|'capsule'|'cyl', size:[..], pos?:[x,y,z], rot?:[x,y,z] }]
   */
  add({ mesh = null, type = 'dynamic', pos = [0, 0, 0], quat = null, rotY = 0, shapes = [], density = 1, friction = 0.7,
    restitution = 0.1, group = GROUPS.prop, linDamp = 0.05, angDamp = 0.3, ccd = false, impact = false, tag = null, canSleep = true }) {
    const R = RAPIER;
    const desc = type === 'fixed' ? R.RigidBodyDesc.fixed()
      : type === 'kinematic' ? R.RigidBodyDesc.kinematicPositionBased() : R.RigidBodyDesc.dynamic();
    desc.setTranslation(pos[0], pos[1], pos[2]);
    const q = quat || new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    desc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    if (type === 'dynamic') { desc.setLinearDamping(linDamp).setAngularDamping(angDamp).setCcdEnabled(ccd).setCanSleep(canSleep); }
    const body = this.world.createRigidBody(desc);
    const ent = { body, mesh, tag, colliders: [], prevP: new THREE.Vector3(...pos), prevQ: q.clone(), dynamic: type !== 'fixed', alive: true };
    for (const s of shapes) {
      let cd;
      const z = s.size;
      if (s.kind === 'box') cd = R.ColliderDesc.cuboid(z[0] / 2, z[1] / 2, z[2] / 2);
      else if (s.kind === 'ball') cd = R.ColliderDesc.ball(z[0]);
      else if (s.kind === 'capsule') cd = R.ColliderDesc.capsule(z[1], z[0]); // [radius, halfHeight]
      else if (s.kind === 'cyl') cd = R.ColliderDesc.cylinder(z[1], z[0]); // [radius, halfHeight]
      if (s.pos) cd.setTranslation(s.pos[0], s.pos[1], s.pos[2]);
      if (s.rot) { const e = new THREE.Quaternion().setFromEuler(new THREE.Euler(...s.rot)); cd.setRotation({ x: e.x, y: e.y, z: e.z, w: e.w }); }
      cd.setDensity(s.density ?? density).setFriction(s.friction ?? friction).setRestitution(restitution).setCollisionGroups(s.group ?? group);
      if (s.sensor) cd.setSensor(true);
      if (impact) { cd.setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS); cd.setContactForceEventThreshold(impact === true ? 400 : impact); }
      const col = this.world.createCollider(cd, body);
      ent.colliders.push(col);
      this.byCollider.set(col.handle, ent);
    }
    if (mesh) { mesh.position.set(...pos); mesh.quaternion.copy(q); }
    this.entities.add(ent);
    return ent;
  }

  remove(ent) {
    if (!ent || !ent.alive) return;
    ent.alive = false;
    for (const c of ent.colliders) this.byCollider.delete(c.handle);
    this.world.removeRigidBody(ent.body);
    this.entities.delete(ent);
    if (ent.mesh && ent.mesh.parent) ent.mesh.parent.remove(ent.mesh);
  }

  joint(a, b, anchorA, anchorB) {
    const jd = RAPIER.JointData.spherical({ x: anchorA[0], y: anchorA[1], z: anchorA[2] }, { x: anchorB[0], y: anchorB[1], z: anchorB[2] });
    return this.world.createImpulseJoint(jd, a.body, b.body, true);
  }

  /** advance; calls pre(STEP) before each fixed step */
  update(dt, pre) {
    this.acc += Math.min(dt, 0.1);
    let n = 0;
    while (this.acc >= STEP && n < 4) {
      for (const e of this.entities) {
        if (!e.dynamic) continue;
        const t = e.body.translation(), r = e.body.rotation();
        e.prevP.set(t.x, t.y, t.z); e.prevQ.set(r.x, r.y, r.z, r.w);
      }
      pre && pre(STEP);
      this.world.step(this.events);
      this.events.drainContactForceEvents((ev) => {
        if (!this.onImpact) return;
        const f = ev.totalForceMagnitude();
        const a = this.byCollider.get(ev.collider1()), b = this.byCollider.get(ev.collider2());
        this.onImpact(a, b, f);
      });
      this.acc -= STEP; n++;
    }
    if (n === 4) this.acc = 0;
    this.alpha = this.acc / STEP;
  }

  sync() {
    const a = this.alpha;
    for (const e of this.entities) {
      if (!e.mesh || !e.dynamic) continue;
      const t = e.body.translation(), r = e.body.rotation();
      e.mesh.position.set(e.prevP.x + (t.x - e.prevP.x) * a, e.prevP.y + (t.y - e.prevP.y) * a, e.prevP.z + (t.z - e.prevP.z) * a);
      _q.set(r.x, r.y, r.z, r.w);
      e.mesh.quaternion.copy(e.prevQ).slerp(_q, a);
    }
  }
}
const _q = new THREE.Quaternion();

export function teleport(ent, x, y, z, resetRot = false) {
  ent.body.setTranslation({ x, y, z }, true);
  ent.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  ent.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  if (resetRot) { ent.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); ent.prevQ.set(0, 0, 0, 1); }
  ent.prevP.set(x, y, z);
}
