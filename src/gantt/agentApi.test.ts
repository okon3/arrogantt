import { describe, expect, it, vi } from 'vitest';
import { createAgentApi, type AgentApi } from './agentApi';
import type { GanttHandle, TaskDetails } from './ganttHandle';
import type { Resource } from '../scheduler';

const ALICE: Resource = { id: 'r1', name: 'Alice' };

const details = (overrides: Partial<TaskDetails> = {}): TaskDetails => ({
  id: 't1',
  name: 'Analisi',
  nominalDays: 2,
  start: new Date(2026, 8, 7, 8, 0),
  end: new Date(2026, 8, 8, 17, 0),
  resourceId: 'r1',
  color: '#3b82f6',
  ownsColor: true,
  progress: 0,
  isSummary: false,
  descendantCount: 0,
  elapsedDays: 2,
  effortDays: 2,
  shared: false,
  contended: false,
  disabled: false,
  cost: 1200,
  uncostedDays: 0,
  dailyRates: [600],
  currency: null,
  ...overrides,
});

/**
 * The API against a handle that only answers what these writes ask it, so a
 * call reaching the chart is visible as a call on the spy.
 */
function harness(task: TaskDetails = details()) {
  const handle = {
    getResources: () => [ALICE],
    getTaskDetails: (id: string) => (id === task.id ? task : null),
    addTask: vi.fn(() => 'tNew'),
    updateTask: vi.fn(),
    setCurrency: vi.fn(),
  };
  const api: AgentApi = createAgentApi({
    handle: () => handle as unknown as GanttHandle,
    filename: () => 'piano.gantt',
    dirty: () => false,
    setFilename: () => {},
    adopt: () => {},
    newProject: () => {},
  });
  return { api, handle };
}

describe('agent API resource assignment', () => {
  it('refuses an id nobody has, naming it', () => {
    const { api } = harness();
    expect(() => api.addTask({ name: 'T', resourceId: 'nope' })).toThrow(/"nope".*does not exist/);
  });

  it('writes nothing when addTask names an unknown resource', () => {
    const { api, handle } = harness();
    expect(() => api.addTask({ resourceId: 'nope' })).toThrow();
    expect(handle.addTask).not.toHaveBeenCalled();
  });

  it('writes nothing when updateTask names an unknown resource', () => {
    const { api, handle } = harness();
    expect(() => api.updateTask('t1', { resourceId: 'nope' })).toThrow(/does not exist/);
    expect(handle.updateTask).not.toHaveBeenCalled();
  });

  it('accepts a resource the project has', () => {
    const { api, handle } = harness();
    expect(api.addTask({ resourceId: 'r1' })).toBe('tNew');
    api.updateTask('t1', { resourceId: 'r1' });
    expect(handle.updateTask).toHaveBeenCalledWith('t1', expect.objectContaining({ resourceId: 'r1' }));
  });

  it('leaves an unassigned write alone', () => {
    const { api, handle } = harness();
    api.addTask({ name: 'T' });
    api.updateTask('t1', { resourceId: null });
    expect(handle.addTask).toHaveBeenCalledWith(expect.objectContaining({ resourceId: undefined }));
    expect(handle.updateTask).toHaveBeenCalledWith('t1', expect.objectContaining({ resourceId: undefined }));
  });
});

describe('agent API disabled flag', () => {
  it('passes a disabled write through to the patch', () => {
    const { api, handle } = harness();
    api.updateTask('t1', { disabled: true });
    expect(handle.updateTask).toHaveBeenCalledWith('t1', expect.objectContaining({ disabled: true }));
  });

  it('keeps the current flag when the caller leaves it out', () => {
    const { api, handle } = harness(details({ disabled: true }));
    api.updateTask('t1', { name: 'Rinominata' });
    expect(handle.updateTask).toHaveBeenCalledWith('t1', expect.objectContaining({ disabled: true }));
  });

  it('passes it through addTask too', () => {
    const { api, handle } = harness();
    api.addTask({ name: 'T', disabled: true });
    expect(handle.addTask).toHaveBeenCalledWith(expect.objectContaining({ disabled: true }));
  });
});

describe('agent API description', () => {
  it('omits the key from getTask on a task with no description', () => {
    const { api } = harness();
    const task = api.getTask('t1');
    expect('description' in task).toBe(false);
  });

  it('reports the description getTask carries', () => {
    const { api } = harness(details({ description: 'nota' }));
    const task = api.getTask('t1');
    expect(task.description).toBe('nota');
  });

  it('writes a description through updateTask', () => {
    const { api, handle } = harness();
    api.updateTask('t1', { description: 'nota' });
    expect(handle.updateTask).toHaveBeenCalledWith('t1', expect.objectContaining({ description: 'nota' }));
  });

  it('removes the description (key set, empty) when the caller passes an empty string', () => {
    const { api, handle } = harness();
    api.updateTask('t1', { description: '' });
    const patch = handle.updateTask.mock.calls[0][1];
    expect('description' in patch).toBe(true);
    expect(patch.description).toBe('');
  });

  it('removes the description (key set, empty) when the caller passes null', () => {
    const { api, handle } = harness();
    api.updateTask('t1', { description: null });
    const patch = handle.updateTask.mock.calls[0][1];
    expect('description' in patch).toBe(true);
    expect(patch.description).toBe('');
  });

  it('leaves the description alone when the caller omits it', () => {
    const { api, handle } = harness();
    api.updateTask('t1', { name: 'Rinominata' });
    const patch = handle.updateTask.mock.calls[0][1];
    expect(patch.description).toBeUndefined();
  });

  it('accepts exactly 2000 characters', () => {
    const { api, handle } = harness();
    const text = 'a'.repeat(2000);
    api.updateTask('t1', { description: text });
    expect(handle.updateTask).toHaveBeenCalledWith('t1', expect.objectContaining({ description: text }));
  });

  it('throws on 2001 characters without calling the handle', () => {
    const { api, handle } = harness();
    expect(() => api.updateTask('t1', { description: 'a'.repeat(2001) })).toThrow(/2001/);
    expect(handle.updateTask).not.toHaveBeenCalled();
  });

  // The surface is driven from plain JS, where the compiler is not in the way:
  // a number stored here parses back as one and makes every later Save refuse.
  it('throws on a description that is not a string, without calling the handle', () => {
    const { api, handle } = harness();
    for (const value of [5, true, [], {}, 0, false]) {
      expect(() => api.updateTask('t1', { description: value as never })).toThrow(
        /expected a string/,
      );
    }
    expect(handle.updateTask).not.toHaveBeenCalled();
  });

  it('refuses addTask when a description is passed, naming the remedy', () => {
    const { api, handle } = harness();
    expect(() => api.addTask({ name: 'a', description: 'b' } as never)).toThrow(
      /addTask does not set a description.*updateTask/,
    );
    expect(handle.addTask).not.toHaveBeenCalled();
  });
});

describe('agent API setCurrency', () => {
  it('forwards a valid label to the handle', () => {
    const { api, handle } = harness();
    api.setCurrency('EUR');
    expect(handle.setCurrency).toHaveBeenCalledWith('EUR');
  });

  it('forwards null to the handle, skipping validation', () => {
    const { api, handle } = harness();
    api.setCurrency(null);
    expect(handle.setCurrency).toHaveBeenCalledWith(null);
  });

  it('throws on an empty label without calling the handle', () => {
    const { api, handle } = harness();
    expect(() => api.setCurrency('')).toThrow();
    expect(handle.setCurrency).not.toHaveBeenCalled();
  });

  it('throws on a 9-character label without calling the handle', () => {
    const { api, handle } = harness();
    expect(() => api.setCurrency('123456789')).toThrow();
    expect(handle.setCurrency).not.toHaveBeenCalled();
  });
});
