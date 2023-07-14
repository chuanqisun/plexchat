export interface Plugin<T> {
  onInit?: OnInitHook<T>;
  onTransformChange?: OnTransformChangeHook<T>;
  onDidChange?: OnDidChangeHook<T>;
}

export type OnInitHook<T> = (input: OnInputHookInput<T>) => T;
export interface OnInputHookInput<T> {
  current: T | undefined;
}

export type OnTransformChangeHook<T> = (input: OnTransformChangeHookInput<T>) => T;
export interface OnTransformChangeHookInput<T> {
  current: T;
  previous: T;
  abort();
  update: Update<T>;
}

export type OnDidChangeHook<T> = (input: HookInput<T>) => void;
export interface HookInput<T> {
  current: T;
  previous: T;
  update: Update<T>;
}

export type Update<T> = (updateFn: (prev: T) => T) => void;

export function createStore<T extends NonNullable<any>>(plugins: Plugin<T>[]) {
  const hooks = plugins.reduce(
    (acc, plugin) => {
      if (plugin.onInit) acc.onInit.push(plugin.onInit);
      if (plugin.onTransformChange) acc.onTransformChange.push(plugin.onTransformChange);
      if (plugin.onDidChange) acc.onDidChange.push(plugin.onDidChange);
      return acc;
    },
    {
      onInit: [] as OnInitHook<T>[],
      onTransformChange: [] as OnTransformChangeHook<T>[],
      onDidChange: [] as OnDidChangeHook<T>[],
    }
  );

  if (!hooks.onInit.length) throw new Error("At least one plugin should have onInit hook");
  let state = hooks.onInit.reduce<undefined | T>((acc, hook) => hook({ current: acc }), undefined)!;

  const onTransformChange = (current, previous) =>
    hooks.onTransformChange.reduce(
      (acc, hook) => {
        if (acc.isAborted) return acc;

        let isAborted = false;
        const updatedState = hook({ current: acc.state, previous, abort: () => (isAborted = true), update });

        return { state: updatedState, isAborted };
      },
      { isAborted: false, state: current }
    );

  const onDidChange = (current: T, previous: T) => {
    plugins
      .map((plugin) => plugin.onDidChange!)
      .filter(Boolean)
      .forEach((hook) => hook({ current, previous, update }));
  };

  function update(updateFn: (prev: T) => T) {
    const prev = state;
    state = onTransformChange(updateFn(prev), prev).state;
    onDidChange(state, prev);
  }

  return {
    update,
  };
}
