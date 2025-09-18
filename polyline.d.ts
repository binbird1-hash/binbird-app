// types/polyline.d.ts
declare module '@mapbox/polyline' {
  interface Polyline {
    decode(encoded: string, precision?: number): number[][];
    encode(coords: number[][], precision?: number): string;
  }

  const polyline: Polyline;
  export default polyline;
}
