function createLogger(name) {
  return async function resolve(...args) {
    try {
      const defaultFn = args.slice(-1)[0];
      const ret = await defaultFn(...args);
      console.log('%s', name, 'return: ', ret, 'args: ', args.slice(0, -1));
      return ret;
    } catch (err) {
      console.log('%s throw: %s args: %s ', name, err, args.slice(0, -1));
      throw err;
    }
  }
}
export let resolve = createLogger('resolve');
export let getFormat = createLogger('getFormat');
export let getSource = createLogger('getSource');
export let transformSource = createLogger('transformSource');
