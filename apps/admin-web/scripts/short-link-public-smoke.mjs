import {
  accountId,
  assertShortLinkDeliverySchema,
  createAdminHeaders,
  createSupabaseAdminClient,
  detectBaseURL,
  getShortLinkRuntimePolicyFlags,
  parseJsonResponse,
} from "./short-link-runtime-utils.mjs";

const baseURL = await detectBaseURL();
const schemaResult = await assertShortLinkDeliverySchema();
const allowDegradedSmoke =
  process.env.SHORT_LINK_SMOKE_ALLOW_DEGRADED === "1" ||
  process.env.SHORT_LINK_FORCE_DIRECT_REDIRECT === "1";

if (!schemaResult.ok) {
  if (schemaResult.connectionFailure) {
    console.error("Short-link public smoke cannot reach Supabase, so schema verification and smoke are blocked.");
    console.error(`Connection error: ${schemaResult.connectionFailure}`);
    console.error(`Required migration: ${schemaResult.migrationFile}`);
    process.exit(1);
  }

  if (!allowDegradedSmoke) {
    console.error("Short-link public smoke is blocked by missing schema.");
    console.error(`Required migration: ${schemaResult.migrationFile}`);
    for (const failure of schemaResult.failures) {
      console.error(`- ${failure.table}: ${failure.message}`);
    }
    process.exit(1);
  }

  console.warn("Short-link public smoke is running in degraded mode.");
  console.warn(`Required migration: ${schemaResult.migrationFile}`);
  for (const failure of schemaResult.failures) {
    console.warn(`- ${failure.table}: ${failure.message}`);
  }
}

const headers = createAdminHeaders();
const supabaseAdmin = createSupabaseAdminClient();
const runtimeFlags = getShortLinkRuntimePolicyFlags();
const createdShortLinkIds = [];
let createdSalesChannelId = null;
const degradedMode = !schemaResult.ok && allowDegradedSmoke;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function uniqueName(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function apiJson(path, init = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers ?? {}),
    },
    redirect: init.redirect ?? "manual",
  });

  const parsed = await parseJsonResponse(response);
  return {
    response,
    body: parsed.json,
    text: parsed.text,
  };
}

try {
  const directTargetUrl = "https://example.com/direct-smoke";

  let landingLink = null;
  if (!degradedMode) {
    const salesChannelName = uniqueName("codex-smoke-channel");
    const { data: salesChannel, error: salesChannelError } = await supabaseAdmin
      .from("sales_channels")
      .insert({
        account_id: accountId,
        name: salesChannelName,
        default_delivery_mode: "landing_page",
        default_landing_template_key: "ctv_neutral",
      })
      .select("id, name")
      .single();

    if (salesChannelError || !salesChannel) {
      throw new Error(
        `Unable to seed sales channel for smoke: ${salesChannelError?.message ?? "unknown error"}`,
      );
    }

    createdSalesChannelId = salesChannel.id;

    const landingTargetUrl = "https://example.com/landing-smoke";
    const landingCreate = await apiJson("/api/short-links", {
      method: "POST",
      body: JSON.stringify({
        target_url: landingTargetUrl,
        title: "Smoke landing link",
        sales_channel_id: createdSalesChannelId,
        delivery_mode: "inherit_channel",
        require_token: false,
        notify_clicks: false,
      }),
    });
    assert(
      landingCreate.response.status === 201,
      `Landing short-link create failed (${landingCreate.response.status}): ${landingCreate.text}`,
    );
    landingLink = landingCreate.body?.data;
    assert(landingLink?.id && landingLink?.slug, "Landing short-link payload is incomplete");
    createdShortLinkIds.push(landingLink.id);
  }

  const directCreate = await apiJson("/api/short-links", {
    method: "POST",
    body: JSON.stringify({
      target_url: directTargetUrl,
      title: "Smoke direct link",
      require_token: false,
      notify_clicks: false,
    }),
  });
  assert(
    directCreate.response.status === 201,
    `Direct short-link create failed (${directCreate.response.status}): ${directCreate.text}`,
  );
  const directLink = directCreate.body?.data;
  assert(directLink?.id && directLink?.slug, "Direct short-link payload is incomplete");
  createdShortLinkIds.push(directLink.id);

  if (landingLink) {
    const landingDetail = await apiJson(`/api/short-links/${landingLink.id}`);
    assert(
      landingDetail.response.status === 200,
      `Landing detail failed (${landingDetail.response.status}): ${landingDetail.text}`,
    );
    const landingPolicy = landingDetail.body?.data?.resolvedPolicy;
    const expectedLandingMode = runtimeFlags.landingEnabled ? "landing_page" : "direct_redirect";
    assert(
      landingPolicy?.effectiveDeliveryMode === expectedLandingMode,
      `Landing policy mismatch. Expected ${expectedLandingMode}, received ${landingPolicy?.effectiveDeliveryMode ?? "unknown"}`,
    );
    if (runtimeFlags.landingEnabled) {
      assert(
        landingPolicy?.effectiveLandingTemplateKey === "ctv_neutral",
        `Landing template mismatch. Expected ctv_neutral, received ${landingPolicy?.effectiveLandingTemplateKey ?? "unknown"}`,
      );
    }

    const crawlerPreview = await fetch(`${baseURL}/s/${landingLink.slug}`, {
      headers: {
        "User-Agent": "TelegramBot/1.0",
      },
      redirect: "manual",
    });
    const crawlerHtml = await crawlerPreview.text();
    assert(crawlerPreview.status === 200, `Crawler preview should return 200, received ${crawlerPreview.status}`);
    assert(
      !crawlerHtml.includes("https://example.com/landing-smoke"),
      "Crawler preview leaked the landing target URL",
    );

    if (runtimeFlags.landingEnabled) {
      const landingPage = await fetch(`${baseURL}/s/${landingLink.slug}`, {
        redirect: "manual",
      });
      const landingHtml = await landingPage.text();
      assert(landingPage.status === 200, `Landing page should render 200, received ${landingPage.status}`);
      assert(
        landingHtml.includes("Mẫu CTV trung tính") || landingHtml.includes("Xác nhận trước khi tiếp tục"),
        "Landing page did not render the neutral template copy",
      );

      const landingGo = await fetch(`${baseURL}/s/${landingLink.slug}/go`, {
        redirect: "manual",
      });
      assert(landingGo.status === 302, `Landing CTA should redirect with 302, received ${landingGo.status}`);
      assert(
        landingGo.headers.get("location") === "https://example.com/landing-smoke",
        `Landing CTA redirected to ${landingGo.headers.get("location") ?? "unknown location"}`,
      );
    } else {
      const landingFallback = await fetch(`${baseURL}/s/${landingLink.slug}`, {
        redirect: "manual",
      });
      assert(
        landingFallback.status === 302,
        `Landing-disabled fallback should redirect immediately, received ${landingFallback.status}`,
      );
      assert(
        landingFallback.headers.get("location") === "https://example.com/landing-smoke",
        `Landing-disabled fallback redirected to ${landingFallback.headers.get("location") ?? "unknown location"}`,
      );
    }
  }

  const directRedirect = await fetch(`${baseURL}/s/${directLink.slug}`, {
    redirect: "manual",
  });
  const directLocation = directRedirect.headers.get("location");
  const normalizedDirectLocation = directLocation ? new URL(directLocation, baseURL) : null;
  const directRedirectBody = directRedirect.status === 302 ? "" : await directRedirect.text();
  assert(
    directRedirect.status === 302,
    (console.error("Direct short-link unexpected response:"), console.error(`- status: ${directRedirect.status}`), console.error(`- location: ${directLocation ?? "null"}`), console.error(`- has_window_location_replace: ${directRedirectBody.includes("window.location.replace(")}`), console.error(`- has_next_redirect: ${directRedirectBody.includes("NEXT_REDIRECT")}`), console.error(`- has_owner_intro_copy: ${directRedirectBody.includes("Mở liên kết an toàn")}`), console.error(`- has_ctv_copy: ${directRedirectBody.includes("Xác nhận trước khi tiếp tục")}`), console.error(`- has_api_direct_path: ${directRedirectBody.includes("/api/s/")}`), console.error(`- has_go_path: ${directRedirectBody.includes("/go")}`), console.error(`- body: ${directRedirectBody.slice(0, 800)}`), `Direct short-link should redirect with 302, received ${directRedirect.status}`),
  );

  const directGoPath = `/s/${directLink.slug}/go`;
  if (directLocation === directTargetUrl) {
    console.warn("Direct short-link still redirects straight to the target URL.");
  } else {
    assert(
      normalizedDirectLocation?.pathname === directGoPath
        || normalizedDirectLocation?.pathname === `/api/s/${directLink.slug}`,
      `Direct short-link should first hop to ${directGoPath} or /api/s/${directLink.slug}, received ${directLocation ?? "null"}`,
    );

    const directHop = await fetch(normalizedDirectLocation?.toString() ?? `${baseURL}${directGoPath}`, {
      redirect: "manual",
    });
    assert(
      directHop.status === 302,
      `Direct hop should redirect with 302, received ${directHop.status}`,
    );
    assert(
      directHop.headers.get("location") === directTargetUrl,
      `Direct hop redirected to ${directHop.headers.get("location") ?? "unknown location"}`,
    );
  }

  console.log("Short-link public smoke passed.");
  console.log(
    `Runtime mode: ${
      degradedMode
        ? "degraded direct-redirect smoke"
        : runtimeFlags.landingEnabled
          ? "landing enabled"
          : "landing disabled -> direct fallback"
    }`,
  );
} finally {
  if (createdShortLinkIds.length > 0) {
    await supabaseAdmin
      .from("short_link_clicks")
      .delete()
      .in("short_link_id", createdShortLinkIds);

    await supabaseAdmin
      .from("short_links")
      .delete()
      .in("id", createdShortLinkIds);
  }

  if (createdSalesChannelId) {
    await supabaseAdmin
      .from("sales_channels")
      .delete()
      .eq("id", createdSalesChannelId);
  }
}
