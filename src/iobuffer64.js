import IOBuffer from 'iobuffer';

export default class IOBuffer64 extends IOBuffer {
  readUint64() {
    const left = this.readUint32();
    const right = this.readUint32();
    if (this.isLittleEndian()) {
      return left << 32 | right;
    }
    return right << 32 | left;
  }

  readInt64() {
    let left, right;
    if (this.isLittleEndian()) {
      left = this.readInt32();
      right = this.readUint32();

      return left << 32 | right;
    }
    left = this.readUint32();
    right = this.readInt32();
    return right << 32 | left;
  }

  readUintVar(numBytes) {
    switch(numBytes) {
      case 1:
        return this.readUint8();
      case 2:
        return this.readUint16();
      case 4:
        return this.readUint32();
      case 8:
        return this.readUint64();
    }
    throw new Error(`Unsupported number of bytes: ${numBytes}`);
  }
}

export function marked(target) {
  return function(buffer, ...params) {
    buffer.pushMark();
    try {
      return target(buffer, ...params);
    } finally {
      buffer.popMark();
    }
  }
}
