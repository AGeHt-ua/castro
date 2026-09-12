const CONFIG_KEY = "shop_config_v1";
const MAP_KEY = "upgrade_map_v1";

const corsHeaders = (request) => {
  const origin = request.headers.get("Origin") || "";
  const allowed = [
    "https://family-castro.fun",
    "https://www.family-castro.fun",
    "http://localhost:8080",
    "http://127.0.0.1:8080"
  ];

  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : "https://family-castro.fun",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
};

const json = (request, data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request)
    }
  });

const readBody = async (request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const loadConfig = async (env) => {
  const raw = await env.SHOP_CONFIG.get(CONFIG_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const saveConfig = async (env, config) => {
  await env.SHOP_CONFIG.put(CONFIG_KEY, JSON.stringify(config));
};

const loadMap = async (env) => {
  const raw = await env.SHOP_CONFIG.get(MAP_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const saveMap = async (env, map) => {
  await env.SHOP_CONFIG.put(MAP_KEY, JSON.stringify(map));
};

const adminIds = (env) =>
  String(env.ADMIN_IDS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const getAuthUser = async (request, env) => {
  const url = env.AUTH_ME_URL || "https://auth.family-castro.fun/auth/me";
  const cookie = request.headers.get("Cookie") || "";
  if (!cookie) return null;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Cookie: cookie },
      cf: { cacheTtl: 0, cacheEverything: false }
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
};

const requireAdmin = async (request, env) => {
  const ids = adminIds(env);
  if (!ids.length) return { ok: false, error: "admin_ids_not_configured" };

  const user = await getAuthUser(request, env);
  const id = String(user?.id || "").trim();
  if (!id || !ids.includes(id)) return { ok: false, error: "forbidden" };

  return { ok: true, user };
};

const normalizeCouponCode = (code) => String(code || "").trim().toUpperCase();

const couponEligibleSubtotal = (coupon, cart) => {
  const scope = coupon?.scope || "all";
  const target = String(coupon?.target || "").trim().toLowerCase();
  const items = Array.isArray(cart) ? cart : [];

  return items.reduce((sum, line) => {
    if (scope === "category" && target && String(line.category || "").toLowerCase() !== target) return sum;
    if (scope === "item" && target && String(line.item?.id || line.id || "").toLowerCase() !== target) return sum;
    return sum + (Number(line.total) || 0);
  }, 0);
};

const validateCoupon = (config, input) => {
  const code = normalizeCouponCode(input?.code);
  const coupons = Array.isArray(config?.coupons) ? config.coupons : [];
  const coupon = coupons.find((x) => normalizeCouponCode(x.code) === code);

  if (!coupon) return { ok: false, error: "coupon_not_found" };
  if (Number(coupon.uses) <= Number(coupon.used || 0)) return { ok: false, error: "coupon_used" };

  const player = String(coupon.player || "").trim().toLowerCase();
  if (player) {
    const buyer = [
      input?.buyer?.nick_static,
      input?.buyer?.discord,
      input?.buyer?.discordMention,
      input?.buyer?.sid
    ].map((x) => String(x || "").toLowerCase());

    if (!buyer.some((x) => x && x.includes(player))) {
      return { ok: false, error: "coupon_wrong_player" };
    }
  }

  const eligible = couponEligibleSubtotal(coupon, input?.cart || input?.items);
  if (eligible <= 0) return { ok: false, error: "coupon_not_applicable" };

  const discount = coupon.type === "fixed"
    ? Math.min(eligible, Number(coupon.value) || 0)
    : Math.floor(eligible * (Number(coupon.value) || 0) / 100);

  if (discount <= 0) return { ok: false, error: "coupon_zero_discount" };

  return {
    ok: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      scope: coupon.scope || "all",
      target: coupon.target || "",
      discount_amount: discount
    }
  };
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/shop/config") {
      const config = await loadConfig(env);
      return json(request, { ok: true, config });
    }

    if ((request.method === "PUT" || request.method === "POST") && url.pathname === "/admin/shop/config") {
      const admin = await requireAdmin(request, env);
      if (!admin.ok) return json(request, { ok: false, error: admin.error }, admin.error === "forbidden" ? 403 : 500);

      const body = await readBody(request);
      const config = body?.config || body;
      if (!config || config.v !== 1 || !Array.isArray(config.products)) {
        return json(request, { ok: false, error: "invalid_config" }, 400);
      }

      config.updated_at = new Date().toISOString();
      config.updated_by = String(admin.user?.id || "");
      await saveConfig(env, config);
      return json(request, { ok: true, config });
    }

    if (request.method === "GET" && url.pathname === "/info/map") {
      const map = await loadMap(env);
      return json(request, { ok: true, map });
    }

    if ((request.method === "PUT" || request.method === "POST") && url.pathname === "/admin/info/map") {
      const admin = await requireAdmin(request, env);
      if (!admin.ok) return json(request, { ok: false, error: admin.error }, admin.error === "forbidden" ? 403 : 500);

      const body = await readBody(request);
      const map = body?.map || body;
      if (!map || map.version !== 1 || !Array.isArray(map.items)) {
        return json(request, { ok: false, error: "invalid_map" }, 400);
      }

      map.updated_at = new Date().toISOString();
      map.updated_by = String(admin.user?.id || "");
      await saveMap(env, map);
      return json(request, { ok: true, map });
    }

    if (request.method === "DELETE" && url.pathname === "/admin/info/map") {
      const admin = await requireAdmin(request, env);
      if (!admin.ok) return json(request, { ok: false, error: admin.error }, admin.error === "forbidden" ? 403 : 500);

      await env.SHOP_CONFIG.delete(MAP_KEY);
      return json(request, { ok: true });
    }

    if (request.method === "POST" && url.pathname === "/coupons/validate") {
      const config = await loadConfig(env);
      if (!config) return json(request, { ok: false, error: "config_not_found" }, 404);
      const body = await readBody(request);
      const result = validateCoupon(config, body || {});
      return json(request, result, result.ok ? 200 : 400);
    }

    return json(request, { ok: false, error: "not_found" }, 404);
  }
};
