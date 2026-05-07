(function() {
  var consent;
  try { consent = localStorage.getItem('consent'); } catch(e) { return; }

  function injectTurnstile() {
    if (!document.querySelector('.cf-turnstile')) return;
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  }

  function disableContactForms(showNotice) {
    var widgets = document.querySelectorAll('.cf-turnstile');
    widgets.forEach(function(w) {
      var form = w.closest('form');
      if (!form) return;
      var submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      if (!showNotice) return;
      var notice = document.createElement('p');
      notice.className = 'form-status error consent-form-notice';
      notice.innerHTML = 'You declined the privacy notice, so the contact form (which uses Cloudflare Turnstile for spam protection) is disabled. Email <a href="mailto:info@eightit.com">info@eightit.com</a> directly, or clear this site\'s storage in your browser to change your choice.';
      w.parentNode.insertBefore(notice, w);
    });
  }

  function build() {
    if (consent === 'accept') { injectTurnstile(); return; }
    if (consent === 'reject') { disableContactForms(true); return; }

    disableContactForms(false);

    var banner = document.createElement('div');
    banner.className = 'consent-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Privacy notice');
    banner.innerHTML =
      '<div class="consent-inner">' +
        '<p class="consent-text">This site can load <strong>Inter from Google Fonts</strong> (sends your IP to Google) and <strong>Cloudflare Turnstile</strong> on contact forms (anti-spam). Until you choose, neither has loaded — system fonts are in use and the contact form is disabled. The site is hosted on Cloudflare. <a href="/privacy.html">Privacy</a> &middot; <a href="/do-not-sell.html">Do Not Sell</a></p>' +
        '<div class="consent-actions">' +
          '<button type="button" class="btn btn-secondary consent-btn" data-consent="reject">Decline</button>' +
          '<button type="button" class="btn btn-primary consent-btn" data-consent="accept">Accept</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(banner);

    banner.addEventListener('click', function(e) {
      var t = e.target.closest('[data-consent]');
      if (!t) return;
      try { localStorage.setItem('consent', t.getAttribute('data-consent')); } catch(err) {}
      location.reload();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
