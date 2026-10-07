/// <reference types="vite/client" />

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

/// <reference types="vite-plugin-pwa/client" />

declare module 'remark-gfm' {
  const remarkGfm: any;
  export default remarkGfm;
}

declare module 'd3' {
  export const select: any;
  export const forceSimulation: any;
  export const forceManyBody: any;
  export const forceCenter: any;
  export const forceCollide: any;
  export const forceX: any;
  export const forceY: any;
  export interface SimulationNodeDatum {
    [key: string]: any;
  }
  const d3: any;
  export default d3;
}
