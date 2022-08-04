## Installation:

```shell
git clone https://github.com/ElawBek/multi-pool.git .
npm install
npx hardhat compile
```

For the tests, you need to create an .env file and enter the necessary parameters, as in .env.example

(Polygon & ethereum - alchemy keys)

(BSC - url mainnet)

```shell
POLYGON_URL=https://polygon-mainnet.g.alchemy.com/v2/<key>
ETHEREUM_URL=https://eth-mainnet.g.alchemy.com/v2/<key>
BSC_URL=
```

---

## Tests

BSC - hardhat.config.ts:

```typescript
hardhat: {
  forking: {
    url: process.env.BSC_URL || "",
    // url: process.env.ETHEREUM_URL || "",
    // blockNumber: 15229540,
    // url: process.env.POLYGON_URL || "",
    // blockNumber: 31227193,
  },
},
```

start node:

```shell
npx hardhat node
```

in another terminal:

```shell
npx hardhat test test/bsc/bnbPool.test.ts --network localhost
npx hardhat test test/bsc/busdPool.test.ts --network localhost
```

---

ehtereum - hardhat.config.ts:

```typescript
hardhat: {
  forking: {
    // url: process.env.BSC_URL || "",
    url: process.env.ETHEREUM_URL || "",
    blockNumber: 15229540,
    // url: process.env.POLYGON_URL || "",
    // blockNumber: 31227193,
  },
},
```

start node:

```shell
npx hardhat node
```

in another terminal:

```shell
npx hardhat test test/ethereum/daiPool.test.ts --network localhost
npx hardhat test test/ethereum/ethPool.test.ts --network localhost
```

---

polygon - hardhat.config.ts:

```typescript
hardhat: {
  forking: {
    // url: process.env.BSC_URL || "",
    // url: process.env.ETHEREUM_URL || "",
    // blockNumber: 15229540,
    url: process.env.POLYGON_URL || "",
    blockNumber: 31227193,
  },
},
```

start node:

```shell
npx hardhat node
```

in another terminal:

```shell
npx hardhat test test/polygon/maticPool.test.ts --network localhost
npx hardhat test test/polygon/usdcPool.test.ts --network localhost
```
