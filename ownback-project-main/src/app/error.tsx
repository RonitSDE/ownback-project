'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="container app-main error-page" id="main">
      <h1>Something broke on our side.</h1>
      <p>No transaction was sent. Your wallet and funds are untouched.</p>
      <div className="btn-row">
        <button className="btn primary" onClick={reset}>
          Try again
        </button>
        <Link className="btn" href="/">
          Back home
        </Link>
      </div>
      {error.digest && <p className="fine">Reference: {error.digest}</p>}
    </main>
  );
}
