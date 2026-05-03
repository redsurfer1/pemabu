import type { NextConfig } from "next";

/**
 * If Edge Function sources under `supabase/functions` still get pulled into the
 * bundle after tsconfig/eslint excludes, try a Webpack-only guard (production
 * builds use Webpack unless you opt into Turbopack for build). Example:
 *
 *   webpack: (config, { webpack }) => {
 *     config.plugins.push(
 *       new webpack.IgnorePlugin({ contextRegExp: /supabase[\\/]functions/ })
 *     );
 *     return config;
 *   },
 *
 * Turbopack ignores `webpack()`; if you use `next build --turbopack`, prefer
 * keeping functions outside any path matched by imports from `app/` or using
 * `experimental.turbo` rules from Next docs for your version.
 */
const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
