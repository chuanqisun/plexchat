import assert from "assert";
import { describe, it } from "node:test";
import { dfsPack, fifoPack, greedyPack } from "../packing";

describe("dfsPack", () => {
  it("should return empty array for empty items input", () => {
    assert.deepEqual(dfsPack(5, []), []);
  });

  it("should return empty array for items that cannot fit into bag", () => {
    assert.deepEqual(dfsPack(1, [2, 3, 4]), []);
  });

  it("should return index of single item that fits exactly into bag", () => {
    assert.deepEqual(dfsPack(5, [5]), [0]);
  });

  it("should return index of single best item for multiple items", () => {
    assert.deepEqual(dfsPack(5, [2, 4, 5]), [2]);
  });

  it("should return indices of multiple items that fit exactly into bag", () => {
    assert.deepEqual(dfsPack(5, [2, 3]), [0, 1]);
  });

  it("should return indices of multiple items that fit best into bag", () => {
    assert.deepEqual(dfsPack(5, [1, 4, 3, 3]), [0, 1]);
  });

  it("should return index of single item for equal items", () => {
    assert.deepEqual(dfsPack(5, [5, 5, 5]), [0]);
  });

  it("should return indices of all items for bag size equal to sum of items", () => {
    assert.deepEqual(dfsPack(10, [2, 3, 5]), [0, 1, 2]);
  });

  it("should handle large bag size", () => {
    assert.deepEqual(dfsPack(100000, [1, 2, 3]), [0, 1, 2]);
  });

  it("should return empty array for bag size 0", () => {
    assert.deepEqual(dfsPack(0, [1, 2, 3]), []);
  });

  it("should be optimal", () => {
    assert.deepEqual(dfsPack(5, [2, 3, 4]), [0, 1]);
  });
});

describe("greedyPack", () => {
  it("should return empty array for empty items input", () => {
    assert.deepEqual(greedyPack(5, []), []);
  });

  it("should return empty array for items that cannot fit into bag", () => {
    assert.deepEqual(greedyPack(1, [2, 3, 4]), []);
  });

  it("should return index of single item that fits exactly into bag", () => {
    assert.deepEqual(greedyPack(5, [5]), [0]);
  });

  it("should return index of single best item for multiple items", () => {
    assert.deepEqual(greedyPack(5, [2, 4, 5]), [2]);
  });

  it("should return indices of multiple items that fit exactly into bag", () => {
    assert.deepEqual(greedyPack(5, [2, 3]), [0, 1]);
  });

  it("should return indices of multiple items that fit best into bag", () => {
    assert.deepEqual(greedyPack(5, [1, 4, 3, 3]), [0, 1]);
  });

  it("should return index of single item for equal items", () => {
    assert.deepEqual(greedyPack(5, [5, 5, 5]), [0]);
  });

  it("should return indices of all items for bag size equal to sum of items", () => {
    assert.deepEqual(greedyPack(10, [2, 3, 5]), [0, 1, 2]);
  });

  it("should handle large bag size", () => {
    assert.deepEqual(greedyPack(100000, [1, 2, 3]), [0, 1, 2]);
  });

  it("should return empty array for bag size 0", () => {
    assert.deepEqual(greedyPack(0, [1, 2, 3]), []);
  });

  it("should be greedy", () => {
    assert.deepEqual(greedyPack(5, [2, 3, 4]), [2]);
  });
});

describe("fifoPack", () => {
  it("should return empty array for empty items input", () => {
    assert.deepEqual(fifoPack(5, []), []);
  });

  it("should return empty array for items that cannot fit into bag", () => {
    assert.deepEqual(fifoPack(1, [2, 3, 4]), []);
  });

  it("should return index of single item that fits exactly into bag", () => {
    assert.deepEqual(fifoPack(5, [5]), [0]);
  });

  it("should return index of first seen item while missing better ones later", () => {
    assert.deepEqual(fifoPack(5, [2, 4, 5]), [0]);
  });

  it("should return indices of multiple items that fit exactly into bag", () => {
    assert.deepEqual(fifoPack(5, [2, 3]), [0, 1]);
  });

  it("should return indices of multiple items that fit best into bag", () => {
    assert.deepEqual(fifoPack(5, [1, 4, 3, 3]), [0, 1]);
  });

  it("should return index of single item for equal items", () => {
    assert.deepEqual(fifoPack(5, [5, 5, 5]), [0]);
  });

  it("should return indices of all items for bag size equal to sum of items", () => {
    assert.deepEqual(fifoPack(10, [2, 3, 5]), [0, 1, 2]);
  });

  it("should handle large bag size", () => {
    assert.deepEqual(fifoPack(100000, [1, 2, 3]), [0, 1, 2]);
  });

  it("should return empty array for bag size 0", () => {
    assert.deepEqual(fifoPack(0, [1, 2, 3]), []);
  });

  it("should be fifo", () => {
    assert.deepEqual(fifoPack(5, [2, 3, 4]), [0, 1]);
  });
});
