import assert from "assert";
import { describe, it } from "node:test";
import { createStore, type Plugin } from "../store";

describe("createStore", () => {
  it("should throw an error if no plugin with onInit hook is provided", () => {
    assert.throws(() => createStore([]), /At least one plugin should have onInit hook/);
  });

  it("should initialize state with the return value of the onInit hook", () => {
    const plugin: Plugin<any> = {
      onInit: ({ current }) => current || "init",
    };
    const store = createStore([plugin]);
    assert.strictEqual(store.getState(), "init");
  });

  it("should update state with the return value of the onTransformChange hook", () => {
    const plugin: Plugin<any> = {
      onInit: ({ current }) => current || "init",
      onTransformChange: ({ current }) => current + " updated",
    };
    const store = createStore([plugin]);
    store.update((state) => state);
    assert.strictEqual(store.getState(), "init updated");
  });

  it("should call onDidChange hook with the current and previous state after an update", () => {
    let onDidChangeCalled = false;
    const plugin: Plugin<any> = {
      onInit: ({ current }) => current || "init",
      onTransformChange: ({ current }) => current + " updated",
      onDidChange: ({ current, previous }) => {
        assert.strictEqual(current, "init updated");
        assert.strictEqual(previous, "init");
        onDidChangeCalled = true;
      },
    };
    const store = createStore([plugin]);
    store.update((state) => state);
    assert.strictEqual(onDidChangeCalled, true);
  });

  it("should abort the update if abort is called in onTransformChange hook", () => {
    const plugin: Plugin<any> = {
      onInit: ({ current }) => current || "init",
      onTransformChange: ({ current, abort }) => {
        abort();
        return current + " updated";
      },
    };
    const store = createStore([plugin]);
    store.update((state) => state);
    assert.strictEqual(store.getState(), "init");
  });

  it("should not call onDidChange if update is aborted", () => {
    let onDidChangeCalled = false;
    const plugin: Plugin<any> = {
      onInit: ({ current }) => current || "init",
      onTransformChange: ({ current, abort }) => {
        abort();
        return current + " updated";
      },
      onDidChange: ({ current, previous }) => {
        onDidChangeCalled = true;
      },
    };
    const store = createStore([plugin]);
    store.update((state) => state);
    assert.strictEqual(onDidChangeCalled, false);
  });

  it("should call onTransformChange hooks in the order they are provided", () => {
    let firstHookCalled = false;
    const plugin1: Plugin<any> = {
      onInit: ({ current }) => current || "init",
      onTransformChange: ({ current }) => {
        firstHookCalled = true;
        return current + " updated";
      },
    };
    const plugin2: Plugin<any> = {
      onTransformChange: ({ current }) => {
        assert.strictEqual(firstHookCalled, true);
        return current + " again";
      },
    };
    const store = createStore([plugin1, plugin2]);
    store.update((state) => state);
    assert.strictEqual(store.getState(), "init updated again");
  });

  it("should call onInit hooks in the order they are provided", () => {
    let firstHookCalled = false;
    const plugin1: Plugin<any> = {
      onInit: ({ current }) => {
        firstHookCalled = true;
        return current || "init";
      },
    };
    const plugin2: Plugin<any> = {
      onInit: ({ current }) => {
        assert.strictEqual(firstHookCalled, true);
        return current + " updated";
      },
    };
    const store = createStore([plugin1, plugin2]);
    assert.strictEqual(store.getState(), "init updated");
  });

  it("should call onDidChange hooks even if state is updated to the same value", () => {
    let onDidChangeCalled = false;
    const plugin: Plugin<any> = {
      onInit: ({ current }) => current || "init",
      onTransformChange: ({ current }) => "init",
      onDidChange: ({ current, previous }) => {
        onDidChangeCalled = true;
      },
    };
    const store = createStore([plugin]);
    store.update((state) => state);
    assert.strictEqual(onDidChangeCalled, true);
  });
});
