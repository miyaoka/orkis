/// <reference types="vite/client" />
/// <reference types="@orkis/preload/src/index.d.ts" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}
