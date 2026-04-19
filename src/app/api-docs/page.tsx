'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import 'swagger-ui-react/swagger-ui.css';

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  ),
});

const CUSTOM_STYLES = `
  .swagger-ui .topbar { display: none; }
  .swagger-ui .info { margin: 20px 0; }
  .swagger-ui .scheme-container {
    background: #f8fafc;
    border-radius: 8px;
    padding: 16px;
    box-shadow: none;
  }
  .swagger-ui .opblock-tag {
    font-size: 18px !important;
    border-bottom: 2px solid #e2e8f0;
  }
  .swagger-ui .opblock {
    border-radius: 8px;
    margin-bottom: 8px;
  }
  .swagger-ui .btn.execute {
    background-color: #3b82f6;
    border-color: #3b82f6;
  }
`;

export default function ApiDocsPage() {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = CUSTOM_STYLES;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Custom header */}
      <header
        style={{
          background: 'linear-gradient(to right, #1d4ed8, #4338ca)',
          color: 'white',
          padding: '16px 24px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', margin: 0 }}>
              ManagerOrder API
            </h1>
            <p style={{ color: '#bfdbfe', fontSize: 14, marginTop: 4 }}>
              Interactive API Documentation &bull; OpenAPI 3.1
            </p>
          </div>
          <Link
            href="/"
            style={{
              fontSize: 14,
              background: 'rgba(255,255,255,0.1)',
              padding: '8px 16px',
              borderRadius: 8,
              color: 'white',
              textDecoration: 'none',
            }}
          >
            ← Back to App
          </Link>
        </div>
      </header>

      {/* Swagger UI */}
      <main style={{ maxWidth: 1280, margin: '0 auto' }}>
        <SwaggerUI
          url="/openapi.yaml"
          docExpansion="list"
          defaultModelsExpandDepth={2}
          filter
          tryItOutEnabled={false}
        />
      </main>
    </div>
  );
}
