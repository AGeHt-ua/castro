# CASTRO Cloudflare API

This Worker stores the shop control-panel config and the info upgrade map in Cloudflare KV.

## Endpoints

- `GET /shop/config` - public shop config read.
- `PUT /admin/shop/config` - admin-only config save.
- `GET /info/map` - public upgrade map read.
- `PUT /admin/info/map` - admin-only upgrade map save.
- `DELETE /admin/info/map` - admin-only upgrade map reset in KV.
- `POST /coupons/validate` - server-side coupon validation helper.

## Required Cloudflare setup

1. Login:

   ```powershell
   npx wrangler login
   ```

2. Create KV namespaces:

   ```powershell
   npx wrangler kv namespace create SHOP_CONFIG
   npx wrangler kv namespace create SHOP_CONFIG --preview
   ```

3. Copy the returned `id` and `preview_id` into `wrangler.toml`.

4. Put your Discord user ID into `ADMIN_IDS` in `wrangler.toml`.
   Multiple admins are comma-separated:

   ```toml
   ADMIN_IDS = "123,456"
   ```

5. Deploy:

   ```powershell
   npx wrangler deploy
   ```

6. In Cloudflare DNS/routes, attach this Worker to the API route that should serve:

   ```text
   https://api.family-castro.fun/shop/*
   https://api.family-castro.fun/admin/shop/*
   https://api.family-castro.fun/info/*
   https://api.family-castro.fun/admin/info/*
   https://api.family-castro.fun/coupons/*
   ```

Do not replace the existing order/review/profile API routes until their current Worker code is merged with this one.
