import { validateBuilderConfig } from './builder-code-policy.mjs';
import { Attribution } from 'ox/erc8021';
try {
  const code = validateBuilderConfig(process.env.NEXT_PUBLIC_BUILDER_CODE, process.env.BUILDER_CODE);
  const suffix = Attribution.toDataSuffix({ codes: [code] });
  if (!suffix.endsWith('80218021802180218021802180218021')) throw Error('Invalid ERC-8021 trailer');
  console.log(
    `ERC-8021 CONFIG PASS: shared OWNBACK Builder Code ${code} (suffix ${suffix.length / 2 - 1} bytes). Confirm actual tx calldata after deployment.`,
  );
} catch (e) {
  console.error(`ERC-8021 CONFIG FAIL: ${e.message}`);
  process.exitCode = 1;
}
