# ncjs
netCDF reading with pure JavaScript

## Installation

```bash
git clone git@github.com:constantinius/ncjs.git
cd ncjs/
npm install
```

To run the tests, run the following command:

```bash
npm test
```

## Usage

```JavaScript
import { parseNetCDF } from 'ncjs';

const netcdfFile = parseNetCDF(arrayBuffer);
```
