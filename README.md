Начало работы:

```shell
git clone https://github.com/ElawBek/multi-pool.git .
npm install
npx hardhat compile
```

Для тестов необходимо создать файл .env и ввести необходимые параметры, как в .env.example:

(Polygon & ethereum - ключи с alchemy)

(BSC - url mainnet)

```shell
POLYGON_URL=https://polygon-mainnet.g.alchemy.com/v2/<key>
ETHEREUM_URL=https://eth-mainnet.g.alchemy.com/v2/<key>
BSC_URL=
```

---

для тестов на BSC в файле hardhat.config.ts:

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

и в терминале:

```
npx hardhat test test/bsc/bnbPool.test.ts
npx hardhat test test/bsc/busdPool.test.ts
```

---

для тестов на ehtereum в файле hardhat.config.ts:

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

и в терминале:

```
npx hardhat test test/ethereum/daiPool.test.ts
npx hardhat test test/ethereum/ethPool.test.ts
```

---

для тестов на ehtereum в файле hardhat.config.ts:

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

и в терминале:

```
npx hardhat test test/polygon/maticPool.test.ts
npx hardhat test test/polygon/usdcPool.test.ts
```
