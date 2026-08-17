import { NextResponse } from 'next/server'

/**
 * Embeddable website widget (CLAUDE.md #26). A customer site includes:
 *   <script src="https://yourapp.com/widget.js" data-widget-key="..." defer></script>
 * No build step — plain vanilla JS, identifies the organization via the
 * PUBLIC widget key only. Posts leads to /api/v1/widget/lead.
 */
export async function GET() {
  const js = `
(function () {
  var script = document.currentScript;
  var widgetKey = script && script.getAttribute('data-widget-key');
  var apiBase = script ? new URL(script.src).origin : '';

  if (!widgetKey) {
    console.warn('[nbos-widget] missing data-widget-key attribute');
    return;
  }

  var bubble = document.createElement('button');
  bubble.textContent = 'Chat with us';
  bubble.setAttribute('aria-label', 'Open chat');
  Object.assign(bubble.style, {
    position: 'fixed', bottom: '20px', right: '20px', zIndex: 999999,
    background: '#087443', color: '#fff', border: 'none', borderRadius: '999px',
    padding: '12px 18px', fontFamily: 'system-ui, sans-serif', fontSize: '14px',
    fontWeight: '600', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.18)'
  });

  var panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed', bottom: '78px', right: '20px', zIndex: 999999,
    width: '300px', background: '#fff', borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
    padding: '16px', fontFamily: 'system-ui, sans-serif', display: 'none'
  });
  panel.innerHTML =
    '<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#111817;">Get in touch</p>' +
    '<input id="nbos-name" placeholder="Name" style="width:100%;margin-bottom:8px;padding:8px;border:1px solid #E5EAE7;border-radius:8px;font-size:13px;box-sizing:border-box;" />' +
    '<input id="nbos-email" placeholder="Email" style="width:100%;margin-bottom:8px;padding:8px;border:1px solid #E5EAE7;border-radius:8px;font-size:13px;box-sizing:border-box;" />' +
    '<textarea id="nbos-message" placeholder="Message" rows="3" style="width:100%;margin-bottom:8px;padding:8px;border:1px solid #E5EAE7;border-radius:8px;font-size:13px;box-sizing:border-box;"></textarea>' +
    '<button id="nbos-send" style="width:100%;padding:10px;background:#087443;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;">Send</button>' +
    '<p id="nbos-status" style="margin:8px 0 0;font-size:12px;color:#66716D;"></p>';

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  bubble.addEventListener('click', function () {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  panel.querySelector('#nbos-send').addEventListener('click', function () {
    var name = panel.querySelector('#nbos-name').value;
    var email = panel.querySelector('#nbos-email').value;
    var message = panel.querySelector('#nbos-message').value;
    var status = panel.querySelector('#nbos-status');
    status.textContent = 'Sending...';

    fetch(apiBase + '/api/v1/widget/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widgetKey: widgetKey, name: name, email: email, message: message })
    })
      .then(function (res) { return res.ok ? status.textContent = "Thanks! We'll be in touch." : Promise.reject(); })
      .catch(function () { status.textContent = 'Something went wrong. Please try again.'; });
  });
})();
`.trim()

  return new NextResponse(js, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
