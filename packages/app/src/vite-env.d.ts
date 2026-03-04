/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string;
  readonly VITE_BUILD_SHA?: string;
  readonly VITE_BUILD_DATE?: string;
  readonly VITE_AUTH_CALLBACK_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
