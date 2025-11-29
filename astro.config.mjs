import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import playformCompress from "@playform/compress";
import terser from "@rollup/plugin-terser";
import expressiveCode from "astro-expressive-code";
import icon from "astro-icon";
import { defineConfig } from "astro/config";
import rehypeExternalLinks from "rehype-external-links";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import rehypeExternalLinks from 'rehype-external-links';

import { CODE_THEME, USER_SITE } from "./src/config.ts";

import updateConfig from "./src/integration/updateConfig.ts";

import { remarkReadingTime } from "./src/plugins/remark-reading-time";

import umami from "@yeskunall/astro-umami";

export default defineConfig({
  integrations: [
    umami({ id: "94db1cb1-74f4-4a40-ad6c-962362670409" }),
  ],
});

// https://astro.build/config
export default defineConfig({
  site: USER_SITE,
  output: "static",
  style: {
    scss: {
      includePaths: ["./src/styles"],
    },
  },
  integrations: [updateConfig(), expressiveCode({
    themes: [CODE_THEME],
    styleOverrides: {
      borderRadius: "0.75rem",
    },
  }), mdx({
      rehypePlugins: [[rehypeExternalLinks, { target: '_blank', rel: [] }]],
    }),
     icon(), terser({
    compress: true,
    mangle: true,
  }), sitemap(), tailwind({
    configFile: "./tailwind.config.mjs",
  }), playformCompress()],
  markdown: {
    remarkPlugins: [remarkMath, remarkReadingTime],
    rehypePlugins: [rehypeKatex, [
      rehypeExternalLinks,
      {
        content: { type: "text", value: "↗" },
      },
    ]],
    rehypePlugins: [[rehypeExternalLinks, { target: '_blank', rel: [] }]],
  },
  trailingSlash: 'never', // "or 'always' if you went with tralingSlash"
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          api: "modern-compiler",
        },
      },
    },
  },
});
