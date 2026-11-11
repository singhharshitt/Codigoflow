import { validateWorkflowGraph, topologicalOrder } from './runner';
import { isExecutableKind, listExecutableKinds } from './registry';

describe('workflow engine', () => {
  it('registers devops executors', () => {
    const kinds = listExecutableKinds();
    expect(kinds).toEqual(
      expect.arrayContaining([
        'terraform.init',
        'ansible.ping',
        'puppet.apply',
        'nagios.status',
        'start',
        'end',
      ]),
    );
    expect(isExecutableKind('terraform.plan')).toBe(true);
    expect(isExecutableKind('future-terraform')).toBe(false);
  });

  it('validates graphs and rejects cycles', () => {
    const nodes = [
      { id: 'a', kind: 'start', config: {} },
      { id: 'b', kind: 'end', config: {} },
    ];
    const ok = validateWorkflowGraph(nodes, [{ source: 'a', target: 'b' }]);
    expect(ok.valid).toBe(true);

    const cyclic = validateWorkflowGraph(nodes, [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' },
    ]);
    expect(cyclic.valid).toBe(false);
    expect(cyclic.errors.some((e) => e.includes('cycle'))).toBe(true);
  });

  it('orders nodes by dependency', () => {
    const nodes = [
      { id: 'start', kind: 'start' },
      { id: 'tf', kind: 'nagios.status' },
      { id: 'end', kind: 'end' },
    ];
    const edges = [
      { source: 'start', target: 'tf' },
      { source: 'tf', target: 'end' },
    ];
    expect(topologicalOrder(nodes, edges)).toEqual(['start', 'tf', 'end']);
  });

  it('rejects unknown node kinds', () => {
    const result = validateWorkflowGraph(
      [{ id: 'x', kind: 'shell', config: {} }],
      [],
    );
    expect(result.valid).toBe(false);
  });
});
