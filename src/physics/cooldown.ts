/** Bounded impact gate: a resting contact cannot repeatedly retrigger a note. */
export class ImpactCooldown {
  private contacts = new Map<string, number>();
  constructor(private readonly duration = 0.12) {}
  accept(marble: number, instrument: string, time: number, strength: number): boolean {
    if (strength < 0.65) return false;
    const key = `${marble}:${instrument}`;
    if (time - (this.contacts.get(key) ?? -Infinity) < this.duration) return false;
    this.contacts.set(key, time);
    return true;
  }
  forget(marble: number) {
    for (const key of this.contacts.keys()) if (key.startsWith(`${marble}:`)) this.contacts.delete(key);
  }
  clear() { this.contacts.clear(); }
}
