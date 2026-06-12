import { describe, expect, it } from 'vitest';
import { createPhaseMachine } from './game';

describe('createPhaseMachine', () => {
  it('démarre sur la phase initiale', () => {
    expect(createPhaseMachine('run').phase).toBe('run');
  });

  it('accepte les transitions autorisées (run → gameover → run)', () => {
    const machine = createPhaseMachine('run');
    machine.transitionTo('gameover');
    expect(machine.phase).toBe('gameover');
    machine.transitionTo('run');
    expect(machine.phase).toBe('run');
  });

  it('rejette une transition interdite', () => {
    const machine = createPhaseMachine('run');
    expect(() => machine.transitionTo('hub')).toThrow();
    expect(machine.phase).toBe('run');
  });
});
