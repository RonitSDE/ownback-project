'use client';

import { WalletProvider } from '@/hooks/useWallet';
import { ToastProvider } from '@/hooks/useToast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <ToastProvider>{children}</ToastProvider>
    </WalletProvider>
  );
}
