import { createStore } from "./store";

export interface Scheduler {
  update: () => {};
}

interface State<J, W> {
  jobs: J[];
  workers: W[];
}

interface Plugin<J, W> {
  onInit?: (input: HookInput<J, W>) => State<J, W>;
  onTransformChange?: (input: HookInput<J, W>) => State<J, W>;
  onDidChange?: (input: HookInput<J, W>) => State<J, W>;
  onShouldSkipChange?: (input: HookInput<J, W>) => boolean;
}

interface HookInput<J, W> {
  current: State<J, W>;
  previous: State<J, W>;
  update: Update<J, W>;
}

export type Update<J, W> = (updateFn: (prev: State<J, W>) => State<J, W>) => void;

export function createScheduler<J, W>(plugins: Plugin<J, W>[]): Update<J, W> {
  const emptyState: State<J, W> = {
    jobs: [],
    workers: [],
  };

  const initialState = plugins
    .map((plugin) => plugin.onInit!)
    .reduce<State<J, W>>((acc, hook) => {
      return hook({ current: acc, previous: emptyState, update: () => {} });
    }, emptyState);

  const onTransformChange = (current, previous) =>
    plugins
      .map((plugin) => plugin.onTransformChange!)
      .filter(Boolean)
      .reduce((acc, hook) => hook({ current: acc, previous, update }), current);

  const onShouldSkipChange = (current, previous) =>
    plugins
      .map((plugin) => plugin.onShouldSkipChange!)
      .filter(Boolean)
      .every((hook) => hook({ current, previous, update }));

  const onDidChange = (current: State<J, W>, previous: State<J, W>) => {
    plugins
      .map((plugin) => plugin.onDidChange!)
      .filter(Boolean)
      .forEach((hook) => hook({ current, previous, update }));
  };

  const { update } = createStore<State<J, W>>({
    onDidChange,
    onShouldSkipChange,
    onTransformChange,
    initialState,
  });

  return update;
}
