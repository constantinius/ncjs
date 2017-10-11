import { hashlittle } from 'jenkins-hash';

export function assertChecksum(buffer, baseAddress, size, checksum) {
  buffer.pushMark();
  buffer.seek(baseAddress);
  const calculatedSum = hashlittle(buffer.readBytes(size));
  buffer.popMark();

  if (calculatedSum !== checksum) {
    throw new Error(`Checksums don't match ${checksum} != ${calculatedSum}`);
  }
}
