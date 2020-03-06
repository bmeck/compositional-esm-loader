/// <references type="node" />
import { default as worker_threads } from 'worker_threads';
import { syncBuiltinESMExports } from 'module';
const { workerData, parentPort } = worker_threads;
worker_threads.workerData = undefined;
worker_threads.parentPort = undefined;
syncBuiltinESMExports();
function init(workerData) {
  const src = `data:text/javascript;base64,${
    Buffer.from(`export * as ns from ${
      JSON.stringify(workerData)
    }`).toString('base64')
  };`;
  return import(src).then(({ ns }) => {
    return { ...ns, then: null };
  });
};
const base = init(workerData);
let nextId = 1;
let pending = new Map();
parentPort.on('message', async ({
  above,
  below
}) => {
  parentPort.close();
  above.on('message', ({id, threw, value}) => {
    if (pending.has(id)) {
      const handlers = pending.get(id);
      pending.delete(id);
      handlers[threw ? 'r' : 'f'](value);
    }
  });
  below.on('message', async ({ topId, id, name, params }) => {
    function callAbove(...args) {
      return new Promise((f, r) => {
        let id = nextId++;
        pending.set(id, {f,r});
        const params = args.slice(0, argc);
        above.postMessage({
          topId,
          id,
          name,
          params,
        });
      });
    }
    let value;
    let threw = false;
    let argc = params.length;

    try {
      const ns = await base;
      if (name in ns !== true) {
        value = await callAbove(...params);
      } else {
        value = ns[name](...params, callAbove);
        value = await value;
      }
    } catch (e) {
      threw = true;
      value = e;
    }
    below.postMessage({
      id,
      threw,
      value,
    });
  })
});
