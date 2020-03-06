function createTimer(name) {
  return function resolve(...args) {
    let start = Date.now();
    try {
      const defaultFn = args.slice(-1)[0];
      return defaultFn(...args);
    } finally {
      console.log('%s time: %d', name, Date.now() - start);
    }
  }
}
export let resolve = createTimer('resolve');
export let getFormat = createTimer('getFormat');
export let getSource = createTimer('getSource');
export let transformSource = createTimer('transformSource');
