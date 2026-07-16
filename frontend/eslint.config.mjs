import { createRequire } from "module";

const require = createRequire(import.meta.url);

// eslint-config-next@16 exports native flat config arrays (CJS)
const nextCoreWebVitals = require("eslint-config-next/core-web-vitals");
const nextTypescript = require("eslint-config-next/typescript");

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default eslintConfig;
