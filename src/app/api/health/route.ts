import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { adapterAbi, ownbackAbi } from '@/lib/abi';
import { addresses, campaignId, chain, isConfigured, rpcUrl } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isConfigured) {
    return NextResponse.json(
      { status: 'unconfigured', chainId: chain.id, hint: 'Set NEXT_PUBLIC_* contract addresses' },
      { status: 503 },
    );
  }
  try {
    const client = createPublicClient({ chain, transport: http(rpcUrl) });
    const [campaign, updatedAt, maxAge, block] = await Promise.all([
      client.readContract({
        address: addresses.ownback!,
        abi: ownbackAbi,
        functionName: 'getCampaign',
        args: [campaignId],
      }),
      client.readContract({
        address: addresses.adapter!,
        abi: adapterAbi,
        functionName: 'priceUpdatedAt',
        args: [addresses.stock!],
      }),
      client.readContract({ address: addresses.adapter!, abi: adapterAbi, functionName: 'maxPriceAge' }),
      client.getBlock(),
    ]);
    const priceAge = Number(block.timestamp - updatedAt);
    const priceFresh = priceAge <= Number(maxAge);
    const ok = campaign.merchant !== '0x0000000000000000000000000000000000000000' && priceFresh;
    return NextResponse.json(
      {
        status: ok ? 'ok' : 'degraded',
        chainId: chain.id,
        campaign: campaignId.toString(),
        priceAgeSeconds: priceAge,
        priceFresh,
        hint: priceFresh ? undefined : 'Keeper is not refreshing prices; settlement will fail closed',
      },
      { status: ok ? 200 : 503 },
    );
  } catch (err) {
    return NextResponse.json({ status: 'degraded', error: (err as Error).message }, { status: 503 });
  }
}
