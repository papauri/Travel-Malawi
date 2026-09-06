/// <reference types="vite/client" />

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

/// <reference types="vite-plugin-pwa/client" />
