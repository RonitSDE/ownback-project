/** Small, offline release-identity invariant. A receipt may predate the release; the proof register may not. */
export function expectedRelease(version) {
  if (typeof version !== 'string' || !/^3\.10\.\d+$/.test(version))
    throw new Error(`Invalid candidate version: ${version}`);
  return `v${version}`;
}
export function assertReleaseIdentity(version, proofRelease, tag = undefined) {
  const expected = expectedRelease(version);
  if (proofRelease !== expected)
    throw new Error(`Release mismatch: package is ${expected}, proofs.json declares ${proofRelease}`);
  if (tag !== undefined && tag !== expected)
    throw new Error(`Tagged SHA mismatch: expected ${expected}, found ${tag}`);
  return expected;
}
