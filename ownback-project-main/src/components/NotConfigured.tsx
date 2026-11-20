export function NotConfigured() {
  return (
    <div className="banner-note info">
      Contracts aren&apos;t configured for this deployment yet. Set the <code>NEXT_PUBLIC_*</code> addresses
      from <code>contracts/deployments/&lt;chainId&gt;.json</code> (see DEPLOY.md).
    </div>
  );
}
