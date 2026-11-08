import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container app-main error-page" id="main">
      <h1>That page doesn&apos;t exist.</h1>
      <p>Try the store or the merchant console.</p>
      <div className="btn-row">
        <Link className="btn primary" href="/shop">
          Go to the store
        </Link>
        <Link className="btn" href="/merchant">
          Merchant console
        </Link>
      </div>
    </main>
  );
}
