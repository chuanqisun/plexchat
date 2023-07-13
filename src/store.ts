interface StoreConfig<T> {
  onTransformChange?: (current: T, previous: T) => T;
  onShouldSkipChange?: (current: T, previous: T) => boolean;
  onDidChange: (current: T, previous: T) => void;
  initialState: T;
}

export function createStore<T>(config: StoreConfig<T>) {
  const { onTransformChange = identity, onShouldSkipChange = isShallowEqual, onDidChange, initialState } = config;
  let state = initialState;

  function update(updateFn: (prev: T) => T) {
    const prev = state;
    const beforeTransform = updateFn(prev);

    const afterTransformed = onTransformChange(beforeTransform, prev);
    if (onShouldSkipChange(afterTransformed, prev)) return;

    state = afterTransformed;

    onDidChange(state, prev);
  }

  return {
    update,
  };
}

function isShallowEqual(a: any, b: any) {
  return a === b;
}

function identity(x: any) {
  return x;
}
