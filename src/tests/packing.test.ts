import assert from "assert";
import { describe, it } from "node:test";
import { solvePackingProblem } from "../packing";

describe("solvePackingProblem", () => {
  it("should return empty array for empty items input", () => {
    assert.deepEqual(solvePackingProblem(5, []), []);
  });

  it("should return empty array for items that cannot fit into bag", () => {
    assert.deepEqual(solvePackingProblem(1, [2, 3, 4]), []);
  });

  it("should return index of single item that fits exactly into bag", () => {
    assert.deepEqual(solvePackingProblem(5, [5]), [0]);
  });

  it("should return index of single best item for multiple items", () => {
    assert.deepEqual(solvePackingProblem(5, [2, 4, 5]), [2]);
  });

  it("should return indices of multiple items that fit exactly into bag", () => {
    assert.deepEqual(solvePackingProblem(5, [2, 3]), [0, 1]);
  });

  it("should return indices of multiple items that fit best into bag", () => {
    assert.deepEqual(solvePackingProblem(5, [1, 4, 3, 3]), [0, 1]);
  });

  it("should return index of single item for equal items", () => {
    assert.deepEqual(solvePackingProblem(5, [5, 5, 5]), [0]);
  });

  it("should return indices of all items for bag size equal to sum of items", () => {
    assert.deepEqual(solvePackingProblem(10, [2, 3, 5]), [0, 1, 2]);
  });

  it("should handle large bag size", () => {
    assert.deepEqual(solvePackingProblem(100000, [1, 2, 3]), [0, 1, 2]);
  });

  it("should return empty array for bag size 0", () => {
    assert.deepEqual(solvePackingProblem(0, [1, 2, 3]), []);
  });
});
