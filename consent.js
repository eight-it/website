(function() {
  try {
    if (localStorage.getItem('consent') === 'set') return;
  } catch(e) { return; }

  function build() {
    var banner = document.createElement('div');
    banner.className = 'consent-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Privacy notice');
    banner.innerHTML =
      '<div class="consent-inner">' +
        '<p class="consent-text">This site loads Inter from <strong>Google Fonts</strong> (transmits your IP to Google) and uses <strong>Cloudflare Turnstile</strong> on contact forms (anti-spam). The site is hosted on Cloudflare. We don’t use analytics or sell your data. <a href="/privacy.html">Privacy</a> &middot; <a href="/do-not-sell.html">Do Not Sell</a></p>' +
        '<div class="consent-actions">' +
          '<button type="button" class="btn btn-secondary consent-btn" data-consent="system-fonts">Use system fonts</button>' +
          '<button type="button" class="btn btn-primary consent-btn" data-consent="accept">OK</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(banner);

    banner.addEventListener('click', function(e) {
      var t = e.target.closest('[data-consent]');
      if (!t) return;
      var action = t.getAttribute('data-consent');
      try {
        localStorage.setItem('consent', 'set');
        if (action === 'system-fonts') {
          localStorage.setItem('fonts', 'system');
          location.reload();
          return;
        }
      } catch(err) {}
      banner.classList.add('consent-banner-out');
      setTimeout(function() { banner.remove(); }, 200);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
