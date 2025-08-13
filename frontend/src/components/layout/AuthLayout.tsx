import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  showLogo?: boolean;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
  showLogo = true,
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {showLogo && (
          <div className="text-center">
            <Link href="/" className="text-4xl font-bold text-primary-600">
              PayControl
            </Link>
            <p className="mt-2 text-sm text-gray-600">
              Gestiona los pagos de tu grupo de manera sencilla
            </p>
          </div>
        )}
        
        <Card className="mt-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            {subtitle && (
              <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
            )}
          </div>
          
          {children}
        </Card>
        
        <div className="text-center">
          <p className="text-xs text-gray-500">
            © 2024 PayControl. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;