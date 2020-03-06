if (!import.meta.resolve) {
  throw new Error('import.meta.resolve must be supported, are you missing --experimental-import-meta-resolve?');
}
import {default as worker_threads, MessageChannel} from 'worker_threads';
import {fileURLToPath, pathToFileURL} from 'url';
let root = null;
async function gatherHelpers() {
  function bail() {
    function delegate(name) {
      return function (...args) {
        const defaultFn = args.slice(-1)[0];
        return defaultFn(...args);
      }
    }
    root = {
      resolve: delegate('resolve'),
      getFormat: delegate('getFormat'),
      getSource: delegate('getSource'),
      transformSource: delegate('transformSource'),
    };
    return root;
  }
  if (typeof process.env.LOADERS !== 'string') {
    return bail();
  }
  const loaders =  JSON.parse(process.env.LOADERS);
  const valid = Array.isArray(loaders) && loaders.every(_ => typeof _ === 'string');
  if (!valid) {
    throw new Error('LOADERS environment variable must be array of JSON strings');
  }
  if (loaders.length === 0) {
    return bail();
  }
  let belowChannel = new MessageChannel();
  let bottomPort = belowChannel.port1;
  let aboveChannel = new MessageChannel();
  for (const loader of loaders) {
    const worker = new worker_threads.Worker(
      fileURLToPath(new URL('./worker.mjs', import.meta.url)),
      {
        workerData: await import.meta.resolve(loader, pathToFileURL(process.cwd() + '/').href),
        execArgv: ['--no-warnings', '--experimental-modules'],
      });
    let belowInsidePort = belowChannel.port2;
    let aboveInsidePort = aboveChannel.port1;
    worker.postMessage({
      below: belowInsidePort,
      above: aboveInsidePort,
    }, [
      belowInsidePort,
      aboveInsidePort,
    ]);
    worker.unref();
    worker.on('exit', (exitCode) => {
      console.error(`Loader ${loader} terminated before process exited.`);
      process.exit(exitCode);
    });
    belowChannel = aboveChannel;
    aboveChannel = new MessageChannel();
  }
  let topPort = belowChannel.port2;
  let nextId = 1;
  let pending = new Map();
  topPort.on('message', async ({ topId, id, name, params }) => {
    let value;
    let threw = false;
    try {
      if (pending.has(topId)) {
        value = await (pending.get(topId).defaultFn(...params));
      } else {
        throw new Error('cannot use default function from dead context');
      }
    } catch (e) {
      value = e;
      threw = true;
    }
    topPort.postMessage({id, threw, value});
  });
  bottomPort.on('message', ({id, threw, value}) => {
    if (pending.has(id)) {
      const handler = pending.get(id);
      pending.delete(id);
      if (pending.size === 0) bottomPort.unref();
      handler[threw ? 'r' : 'f'](value);
    }
  });
  bottomPort.unref();
  topPort.unref();
  const TypedArray = Object.getPrototypeOf(Uint8Array.prototype).constructor;
  const ArrayBuffer = globalThis.ArrayBuffer;
  function delegate(name) {
    return function (...args) {
      const defaultFn = args.pop();
      return new Promise((f, r) => {
        bottomPort.ref();
        let id = nextId++;
        pending.set(id, {
          f: (_) => {
            if (_ instanceof TypedArray || _ instanceof ArrayBuffer) {
              _ = Buffer.from(_);
            }
            if (_ && typeof _ === 'object' && _.source instanceof TypedArray || _.source instanceof ArrayBuffer) {
              _.source = Buffer.from(_.source);
            }
            f(_);
          }, r, defaultFn });
        bottomPort.postMessage({
          topId: id,
          id,
          name,
          params: args
        });
      });
    }
  }
  root = {
    resolve: delegate('resolve'),
    getFormat: delegate('getFormat'),
    getSource: delegate('getSource'),
    transformSource: delegate('transformSource'),
  };
  return root;
}
let ready = gatherHelpers();
/**
 * 
 * @param {keyof root} name
 */
function createExport(name) {
  return function (...args) {
    if (root !== null) {
      return root[name](...args);
    }
    return ready.then((root) => {
      return root[name](...args);
    });
  }
}
export let resolve = createExport('resolve');
export let getFormat = createExport('getFormat');

// waiting on text decoder fixes
export let getSource = createExport('getSource');
export let transformSource = createExport('transformSource');
