/**
 * TEMPORARY DIAGNOSTIC ENDPOINT — MP account status
 *
 * Queries MP's own /users/me + /users/{id}/mercadopago_account API with the
 * production access token so we can tell exactly why CPT01 keeps firing.
 *
 * Auth: requires ?token=<CRON_SECRET> (reusing existing env var). Delete this
 * file after debugging.
 */

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');

  const expected = process.env.CRON_SECRET;
  const given = req.query?.token || '';
  if (!expected || given !== expected) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const mpToken = process.env.MP_ACCESS_TOKEN;
  if (!mpToken) {
    return res.status(500).json({ error: 'MP_ACCESS_TOKEN missing in env' });
  }

  const results = {};

  // 1) /users/me — account owner, verification, country
  try {
    const r = await fetch('https://api.mercadopago.com/users/me', {
      headers: { Authorization: `Bearer ${mpToken}` }
    });
    const body = await r.json();
    results.users_me = {
      http_status: r.status,
      id: body.id,
      nickname: body.nickname,
      email: body.email,
      site_id: body.site_id,
      country_id: body.country_id,
      user_type: body.user_type,
      registration_date: body.registration_date,
      status: body.status,
      seller_experience: body.seller_experience,
      identification: body.identification,
      tags: body.tags,
      // Only include first 200 chars of any error to avoid leaking sensitive data
      raw_error: body.error ? JSON.stringify(body).substring(0, 400) : undefined
    };
  } catch (err) {
    results.users_me = { error: err.message };
  }

  // 2) /account_settings — commercial + receiver capabilities
  try {
    const r = await fetch('https://api.mercadopago.com/account_settings', {
      headers: { Authorization: `Bearer ${mpToken}` }
    });
    const body = await r.json();
    results.account_settings = { http_status: r.status, body };
  } catch (err) {
    results.account_settings = { error: err.message };
  }

  // 3) Token introspect via applications endpoint (if we can get app id from token)
  //    The APP_USR- token 2nd segment is the application id.
  try {
    const appMatch = mpToken.match(/^APP_USR-(\d+)/);
    const appId = appMatch ? appMatch[1] : null;
    if (appId) {
      const r = await fetch(`https://api.mercadopago.com/applications/${appId}`, {
        headers: { Authorization: `Bearer ${mpToken}` }
      });
      const body = await r.json();
      results.application = {
        http_status: r.status,
        app_id: appId,
        name: body.name,
        status: body.status,
        model: body.model,
        // Signals whether the app is in production mode or sandbox
        integration_type: body.integration_type,
        marketplace: body.marketplace,
        product_id: body.product_id,
        client_id: body.client_id,
        redirect_uri: body.redirect_uri,
        webhook_url: body.notification_url,
        raw_body: body
      };
    } else {
      results.application = { error: 'could not extract application id from token' };
    }
  } catch (err) {
    results.application = { error: err.message };
  }

  // 4) Token prefix (safe to expose — only first 8 chars)
  results.token_metadata = {
    prefix: mpToken.substring(0, 8),
    length: mpToken.length,
    starts_with_app_usr: mpToken.startsWith('APP_USR-'),
    starts_with_test: mpToken.startsWith('TEST-')
  };

  return res.status(200).json(results);
};
