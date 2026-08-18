import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/** eslint-config-next 16 ships flat configs directly — no FlatCompat needed. */
const config = [
  ...coreWebVitals,
  ...typescript,
  { ignores: [".next/**", "node_modules/**", "public/**", "data/generated/**", "scripts/**"] },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
      // Feed/player effects reset media on id change — not a cascade bug.
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default config;
