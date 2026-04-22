declare module 'swagger-ui-react' {
  import { ComponentType } from 'react';

  interface SwaggerUIProps {
    url?: string;
    spec?: object;
    docExpansion?: 'list' | 'full' | 'none';
    defaultModelsExpandDepth?: number;
    defaultModelExpandDepth?: number;
    filter?: boolean | string;
    tryItOutEnabled?: boolean;
    supportedSubmitMethods?: string[];
    deepLinking?: boolean;
    showExtensions?: boolean;
    showCommonExtensions?: boolean;
    displayOperationId?: boolean;
    displayRequestDuration?: boolean;
    requestInterceptor?: (req: unknown) => unknown;
    responseInterceptor?: (res: unknown) => unknown;
    onComplete?: () => void;
    presets?: unknown[];
    plugins?: unknown[];
    layout?: string;
    persistAuthorization?: boolean;
  }

  const SwaggerUI: ComponentType<SwaggerUIProps>;
  export default SwaggerUI;
}
