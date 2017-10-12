import IOBuffer from 'iobuffer';

export default class IOBuffer64 extends IOBuffer {
  readUint64() {
    const left = this.readUint32();
    const right = this.readUint32();
    if (this.isLittleEndian()) {
      return (left << 32) | right;
    }
    return (right << 32) | left;
  }

  readInt64() {
    if (this.isLittleEndian()) {
      return (this.readInt32() << 32) | this.readUint32();
    }
    return (this.readInt32() << 32) | this.readUint32();
  }

  readUintVar(numBytes) {
    switch (numBytes) {
      case 1:
        return this.readUint8();
      case 2:
        return this.readUint16();
      case 4:
        return this.readUint32();
      case 8:
        return this.readUint64();
      default:
        throw new Error(`Unsupported number of bytes: ${numBytes}`);
    }
  }
}
