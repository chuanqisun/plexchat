// type MergeDict<T extends object[]> = T extends [infer First, ...infer Rest]
//   ? First extends object
//     ? Rest extends object[]
//       ? MergeDict<Rest> & First
//       : never
//     : never
//   : {};

// // example usage
// type Result = MergeDict<[{a: number}, {b: string}]>; // {a: number, b: string}

// type MergeReturnTypes<T extends Array<() => any>> = T extends [infer First, ...infer Rest]
//     ? First extends (() => infer R) ? (Rest extends Array<() => any> ? MergeReturnTypes<Rest> & R : R) : never
//     : {};

// // example usage
// type Result2 = MergeReturnTypes<[() => {a: number}, () => {b: string}, () => {b: boolean}]>; // {a: number, b: string}

type Fn = (...args: any[]) => any;
type MergeReturnTypes<T extends Array<Fn>> = T extends [infer First, ...infer Rest]
  ? First extends (...args: any[]) => infer R
    ? Rest extends Array<Fn>
      ? MergeReturnTypes<Rest> & Omit<R, keyof MergeReturnTypes<Rest>>
      : R
    : never
  : {};

// example usage
type Result3 = MergeReturnTypes2<[() => { a: number }, (k: boolean) => { a: string }]>; // {a: string}
let r: Result3;
