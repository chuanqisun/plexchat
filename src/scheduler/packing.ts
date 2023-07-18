type Bag = {
  sum: number;
  itemIndices: number[];
};

export function dfsPack(bagSize: number, items: number[]): number[] {
  let currentBag: Bag = { sum: 0, itemIndices: [] };
  let bestBag: Bag = { sum: 0, itemIndices: [] };

  dfs(items, bagSize, 0, currentBag, bestBag);

  return bestBag.itemIndices;
}

function dfs(items: number[], bagSize: number, index: number, currentBag: Bag, bestBag: Bag): void {
  if (bagSize === 0 || index === items.length) {
    if (currentBag.sum > bestBag.sum) Object.assign(bestBag, { sum: currentBag.sum, itemIndices: [...currentBag.itemIndices] });
  } else {
    if (bagSize - items[index] >= 0) {
      currentBag.sum += items[index];
      currentBag.itemIndices.push(index);
      dfs(items, bagSize - items[index], index + 1, currentBag, bestBag);
      currentBag.sum -= items[index];
      currentBag.itemIndices.pop();
    }

    dfs(items, bagSize, index + 1, currentBag, bestBag);
  }
}

export function greedyPack(bagSize: number, items: number[]): number[] {
  const sortedItemsWithOriginalIndex = [...items].map((size, index) => ({ size, index })).sort((a, b) => b.size - a.size);
  let currentBag: Bag = { sum: 0, itemIndices: [] };

  for (let i = 0; i < sortedItemsWithOriginalIndex.length; i++) {
    if (currentBag.sum + sortedItemsWithOriginalIndex[i].size <= bagSize) {
      currentBag.sum += sortedItemsWithOriginalIndex[i].size;
      currentBag.itemIndices.push(sortedItemsWithOriginalIndex[i].index);
    }
  }

  return currentBag.itemIndices.sort();
}
