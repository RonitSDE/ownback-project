/** Run only after a successful Base Sepolia/Mainnet transaction is confirmed.
 * A smart wallet may embed the suffix in an inner UserOperation, which this
 * conservative top-level checker cannot prove. Use Base's AA checker instead.
 */
import 'dotenv/config';
import { createPublicClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { codesFromTxCalldata, validateBuilderCode } from './builder-code-policy.mjs';
const [hash] = process.argv.slice(2);
try {
  const code = validateBuilderCode(process.env.BUILDER_CODE);
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash || ''))
    throw Error('Pass one confirmed transaction hash as the argument');
  const chainId = Number(process.env.ATTRIBUTION_CHAIN_ID || 84532);
  if (![84532, 8453].includes(chainId)) throw Error('Only Base Sepolia or Base Mainnet supported');
  const rpc = chainId === 8453 ? process.env.BASE_MAINNET_RPC_URL : process.env.BASE_SEPOLIA_RPC_URL;
  if (!rpc) throw Error('Set BASE_SEPOLIA_RPC_URL or BASE_MAINNET_RPC_URL');
  const client = createPublicClient({ chain: chainId === 8453 ? base : baseSepolia, transport: http(rpc) });
  const [receipt, tx] = await Promise.all([
    client.getTransactionReceipt({ hash }),
    client.getTransaction({ hash }),
  ]);
  if (receipt.status !== 'success') throw Error('Transaction receipt not successful');
  if (receipt.blockHash !== tx.blockHash) throw Error('Transaction and receipt block mismatch');
  const codes = codesFromTxCalldata(tx.input);
  if (!codes.includes(code))
    throw Error(
      'OWNBACK code missing from top-level transaction calldata. For AA/UserOperation relay verify inner call with Base Builder Code checker. Do NOT claim attributed.',
    );
  console.log(
    JSON.stringify(
      {
        status: 'ATTRIBUTION_VERIFIED_TOP_LEVEL',
        chainId,
        hash,
        blockNumber: receipt.blockNumber.toString(),
        code,
        codes,
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(`ATTRIBUTION NOT VERIFIED: ${e.message}`);
  process.exitCode = 1;
}
