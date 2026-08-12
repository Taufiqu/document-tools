declare module '@vercel/analytics/react' {
  import React from 'react';

  export interface AnalyticsProps {
    beforeSend?: (event: any) => any;
    debug?: boolean;
    mode?: 'auto' | 'development' | 'production';
    endpoint?: string;
    scriptSrc?: string;
    route?: string | null;
    path?: string | null;
  }

  export function Analytics(props?: AnalyticsProps): React.JSX.Element | null;
}
