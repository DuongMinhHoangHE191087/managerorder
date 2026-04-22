import { register } from "node:module";

register(new URL("./ts-path-alias-loader.mjs", import.meta.url).href, import.meta.url);
