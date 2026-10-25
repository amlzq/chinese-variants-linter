import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 扩展代码大量依赖 DOM API（选区、可编辑元素、事件派发），统一使用 jsdom。
    environment: "jsdom",
    // 入口测试放在 tests/ 下，避免 WXT 把 *.test.ts 误识别为同名 entrypoint。
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts", "entrypoints/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "tests/**/*.test.ts",
        "src/assets/rules/**",
        "src/content/ui/styles.ts",
        // 纯类型/常量声明，无可执行语句
        "src/shared/locale/messages.ts",
        "src/shared/locale/types.ts",
        "src/shared/messages/**",
        "src/shared/types/**",
      ],
    },
  },
});
