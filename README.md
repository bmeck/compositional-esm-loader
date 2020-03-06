# Compositional ESM Loader

## Enabling

Enable the compositional loader using `--loader` and `--experimental-import-meta-resolve`

```console
node --loader @bradleymeck/compositional-esm-loader --experimental-import-meta-resolve app.js
```

To compose loaders together use the `LOADERS` environment variable.
This is currently a JSON Array of string specifiers.
Specifiers will be imported relative to the current working directory.

```console
LOADERS='[
  "./example/log-hooks.mjs",
  "@bradleymeck/compositional-esm-loader/example/time-hooks.mjs"
]' \
node \
  --loader @bradleymeck/compositional-esm-loader \
  --experimental-import-meta-resolve \
  ./example/main.mjs
```

Loaders will be called from left to right in a chained delegation form of composition. In the case above `log-hooks.mjs` will be called first as the "bottom loader" and `time-hooks.mjs` will be above it.

## Terminology

The loader list can be thought of as a list going from a bottom loader to a top loader.

* bottom loader - the first loader called by node.
* top loader - the loader that performs the default behavior of node.
* above - A loader A is said to be "above" another loader B if it must be delegated to by the loader B which "below" it.
* below - A loader B is said to be "below" another loader A if it is able to call the behavior of loader A when performing a hook.

## Creating Loaders

NOTE: `dynamicInstantiate` is DISABLED for composition.

All hooks can use their default function to call behavior to the loader above them.

```mjs
// no-op.mjs
export function resolve(specifier, context, defaultResolve) {
  return defaultResolve(specifier, context);
}
```

If a loaders does not implement a hook, it will be skipped. A loader is thought of as implementing a hook if it has the appropriately named export, not if that export is a function.

```mjs
// bad.mjs

// this will cause errors if this loader is called to resolve something
export let resolve = null;
```

## Trust

Currently there is not a cohesive trust model amongst loader composition.

`getSource` and `transformSource` are disabled while some bugs are resolved.

This is to be worked on.

Loaders preempting others to gain privilege to APIs desiring to be censored needs more investigation.
