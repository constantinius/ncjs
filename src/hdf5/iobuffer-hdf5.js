import IOBuffer64 from '../iobuffer64';

export default class HDF5IOBuffer extends IOBuffer64 {
  constructor(buffer, offsetSize, lengthsSize) {
    super(buffer);
    this._offsetSize = offsetSize;
    this._lengthsSize = lengthsSize;
    this.seek(buffer.offset);
  }

  get offsetSize() {
    return this._offsetSize;
  }

  get lengthsSize() {
    return this._lengthsSize;
  }

  readOffset() {
    return this.readUintVar(this._offsetSize);
  }

  readLength() {
    return this.readUintVar(this._lengthsSize);
  }
}
