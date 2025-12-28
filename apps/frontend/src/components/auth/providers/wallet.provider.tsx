'use client';

import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ConnectionProvider,
  useWallet,
  WalletProvider as WalletProviderWrapper,
} from '@solana/wallet-adapter-react';
import {
  TorusWalletAdapter,
  BitgetWalletAdapter,
  CloverWalletAdapter,
  Coin98WalletAdapter,
  FractalWalletAdapter,
  HyperPayWalletAdapter,
  KeystoneWalletAdapter,
  KrystalWalletAdapter,
  LedgerWalletAdapter,
  MathWalletAdapter,
  NightlyWalletAdapter,
  NufiWalletAdapter,
  OntoWalletAdapter,
  ParticleAdapter,
  PhantomWalletAdapter,
  SafePalWalletAdapter,
  SaifuWalletAdapter,
  SalmonWalletAdapter,
  SolflareWalletAdapter,
  TokenaryWalletAdapter,
  TrustWalletAdapter,
  XDEFIWalletAdapter,
  TokenPocketWalletAdapter,
} from '@postiz/wallets';
import {
  WalletModalProvider,
  useWalletModal,
} from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { WalletUiProvider } from '@gitroom/frontend/components/auth/providers/placeholder/wallet.ui.provider';
/**
 * WalletProvider - Main wallet authentication component wrapper
 * Sets up Solana wallet adapter providers and handles initial login flow
 * @returns React component providing wallet authentication interface
 */
const WalletProvider = () => {
  /**
   * Navigate to login with Farcaster provider
   * @param code - Authorization code from Farcaster
   */
  const gotoLogin = useCallback(async (code: string) => {
    window.location.href = `/auth?provider=FARCASTER&code=${code}`;
  }, []);
  return <ButtonCaster login={gotoLogin} />;
};
/**
 * ButtonCaster component - Renders the wallet connection interface
 * @param props - Component props including login callback
 * @returns React component for wallet connection
 */
export const ButtonCaster: FC<{
  login: (code: string) => void;
}> = (props) => {
  // Use 'mainnet-beta' as the Solana network (equivalent to WalletAdapterNetwork.Mainnet)
  const network = 'mainnet-beta';

  // Generate the RPC endpoint URL for the specified network
  const endpoint = useMemo(() => clusterApiUrl(network as any), [network]);
  const wallets = useMemo(
    () => [
      new TokenPocketWalletAdapter(),
      new TorusWalletAdapter(),
      new BitgetWalletAdapter(),
      new CloverWalletAdapter(),
      new Coin98WalletAdapter(),
      new FractalWalletAdapter(),
      new HyperPayWalletAdapter(),
      new KeystoneWalletAdapter(),
      new KrystalWalletAdapter(),
      new LedgerWalletAdapter(),
      new MathWalletAdapter(),
      new NightlyWalletAdapter(),
      new NufiWalletAdapter(),
      new OntoWalletAdapter(),
      new ParticleAdapter(),
      new PhantomWalletAdapter(),
      new SafePalWalletAdapter(),
      new SaifuWalletAdapter(),
      new SalmonWalletAdapter(),
      new SolflareWalletAdapter(),
      new TokenaryWalletAdapter(),
      new TrustWalletAdapter(),
      new XDEFIWalletAdapter(),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [network]
  );
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProviderWrapper wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <DisabledAutoConnect />
        </WalletModalProvider>
      </WalletProviderWrapper>
    </ConnectionProvider>
  );
};
/**
 * DisabledAutoConnect - Prevents wallet auto-connection on mount
 * Explicitly disconnects any auto-connected wallet and then allows manual connection
 * @returns React component that initializes disconnected wallet state
 */
const DisabledAutoConnect = () => {
  const [connect, setConnect] = useState(false);
  const wallet = useWallet();

  /**
   * Handle wallet disconnection on component mount
   * Ensures wallet starts in disconnected state despite auto-connect setting
   */
  const toConnect = useCallback(async () => {
    try {
      wallet.select(null);
    } catch (err) {
      /** empty */
    }
    try {
      await wallet.disconnect();
    } catch (err) {
      /** empty */
    }
    setConnect(true);
  }, []);
  useEffect(() => {
    toConnect();
  }, []);
  if (connect) {
    return <InnerWallet />;
  }
  return <WalletUiProvider />;
};
/**
 * InnerWallet - Handles wallet connection and authentication flow
 * Manages wallet selection, signing, and backend challenge verification
 * @returns React component for wallet interaction and authentication
 */
const InnerWallet = () => {
  const walletModal = useWalletModal();
  const wallet = useWallet();
  const fetch = useFetch();

  // Determine button state based on wallet connection status
  const buttonState = wallet?.connected ? 'connected' : 'disconnected';

  /**
   * Handle wallet authentication with backend challenge verification
   * Retrieves challenge from backend, signs it with wallet, and redirects to auth with signed proof
   */
  const connect = useCallback(async () => {
    // Only proceed if wallet is already connected
    if (buttonState !== 'connected') {
      return;
    }
    try {
      const challenge = await (
        await fetch(
          `/auth/oauth/WALLET?publicKey=${wallet?.publicKey?.toString()}`
        )
      ).text();
      const encoded = new TextEncoder().encode(challenge);
      const signed = await wallet?.signMessage?.(encoded)!;
      const info = Buffer.from(
        JSON.stringify({
          // @ts-ignore
          signature: Buffer.from(signed).toString('hex'),
          challenge,
          publicKey: wallet?.publicKey?.toString(),
        })
      ).toString('base64');
      window.location.href = `/auth?provider=WALLET&code=${info}`;
    } catch (err) {
      walletModal.setVisible(false);
      wallet.select(null);
      wallet.disconnect().catch(() => {
        /** empty */
      });
    }
  }, [wallet, buttonState]);
  useEffect(() => {
    // Trigger authentication when wallet becomes connected
    if (buttonState === 'connected') {
      connect();
    }
  }, [buttonState, connect]);
  return (
    <div onClick={() => walletModal.setVisible(true)} className="flex-1">
      <WalletUiProvider />
    </div>
  );
};
export default WalletProvider;
