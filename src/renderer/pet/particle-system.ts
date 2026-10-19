/**
 * Particle system for visual effects.
 * Bounded particle count to maintain performance.
 */

import type { Particle } from "../../core/types";

const MAX_PARTICLES = 100;

export class ParticleSystem {
  private particles: Particle[] = [];
  private maxParticles: number = MAX_PARTICLES;

  /**
   * Spawn a new particle.
   */
  spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    color: string
  ): void {
    if (this.particles.length >= this.maxParticles) {
      // Remove oldest particle
      this.particles.shift();
    }

    this.particles.push({
      x,
      y,
      vx,
      vy,
      life,
      maxLife: life,
      size,
      color,
      alpha: 1,
    });
  }

  /**
   * Spawn a burst of particles.
   */
  spawnBurst(
    x: number,
    y: number,
    count: number,
    speed: number,
    life: number,
    size: number,
    color: string
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.5 + Math.random() * 0.5);
      this.spawn(
        x,
        y,
        Math.cos(angle) * velocity,
        Math.sin(angle) * velocity,
        life * (0.5 + Math.random() * 0.5),
        size,
        color
      );
    }
  }

  /**
   * Update all particles.
   */
  update(deltaMs: number): void {
    const dt = deltaMs / 1000;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= deltaMs;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = p.life / p.maxLife;
    }
  }

  /**
   * Get all active particles.
   */
  getParticles(): Particle[] {
    return [...this.particles];
  }

  /**
   * Clear all particles.
   */
  clear(): void {
    this.particles = [];
  }

  /**
   * Get particle count.
   */
  getCount(): number {
    return this.particles.length;
  }
}
