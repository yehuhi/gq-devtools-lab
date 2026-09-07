const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const TEACHER_PIN = process.env.TEACHER_PIN || 'GQ2026';
const teacherSessions = new Map();
const TEACHER_SESSION_MS = 8 * 60 * 60 * 1000;

const teacherSolutions = {
  E1:{steps:'Inspect the Admin navigation area, locate #admin-link, and remove the CSS class that hides it.',console:'',network:'No Network request is expected. This is a DOM/CSS-only change.',conclusion:'The link can be made visible locally, but visibility is not authorization. A secure backend must still reject unauthorized access.'},
  E2:{steps:'Inspect the page for #secret-sale or an element using display:none, then remove the hiding rule.',console:'',network:'No API call should occur.',conclusion:'The content already existed in the DOM and was only hidden by CSS. Hidden client-side content should never contain sensitive data.'},
  E3:{steps:'Inspect the First name input, change maxlength from 20 to 100, then enter more than 20 characters and submit.',console:'',network:'This training registration form is client-side only, so no API request is expected here.',conclusion:'Client-side maxlength can be changed by the user. Important length rules must also be enforced by the backend.'},
  E4:{steps:'Inspect the email input and change type="email" to type="text". Enter an invalid value and submit.',console:'',network:'No API request is expected in this form.',conclusion:'Browser email validation is easy to bypass. Server-side validation is required.'},
  E5:{steps:'Remove the required attribute from a mandatory field and submit the form with that field empty.',console:'',network:'No API request is expected in this demo form.',conclusion:'required is a browser convenience, not a security or business-rule boundary.'},
  E6:{steps:'Change the password input type from password to text.',console:'',network:'No Network change is expected.',conclusion:'The value was already present in the browser. input type only controls presentation.'},
  E7:{steps:'Inspect Quantity, change max="10" to max="100", then enter 50.',console:'',network:'No API request is expected from this demo checkout control.',conclusion:'A max attribute can be manipulated. Quantity limits must be validated server-side when an order is submitted.'},
  E8:{steps:'Inspect Place order and remove disabled. Click it without completing the normal UI condition.',console:'',network:'No real order API is called by this demo button.',conclusion:'A disabled button is not access control. The backend must validate terms, payment, stock and other rules independently.'},
  E9:{steps:'Edit the visible price of Focus Pro Headphones from $99.99 to $1.00, then trigger GET /api/products and compare.',console:'',network:'GET /api/products still returns 99.99 for product 101.',conclusion:'Changing DOM text changes only what this browser displays. The source-of-truth price remains unchanged on the server.'},
  E10:{steps:'Change padding, width or font-size on a product card using the Styles pane.',console:'',network:'No Network request is expected.',conclusion:'DevTools style edits are temporary local experiments and disappear when the page reloads.'},
  C1:{steps:'Use querySelectorAll to select every button and return the collection length.',console:'document.querySelectorAll("button").length',network:'No request is expected.',conclusion:'Console can quickly count UI elements without manually scanning the page.'},
  C2:{steps:'Convert the NodeList of buttons to an array and map each button to its visible text.',console:'[...document.querySelectorAll("button")].map(b => b.innerText.trim()).filter(Boolean)',network:'No request is expected.',conclusion:'Small Console scripts are useful for fast inspection of large pages.'},
  C3:{steps:'Select buttons and filter by the disabled property.',console:'[...document.querySelectorAll("button")].filter(b => b.disabled)',network:'No request is expected.',conclusion:'This quickly reveals controls currently blocked by the UI.'},
  C4:{steps:'Select required inputs and return their name or id.',console:'[...document.querySelectorAll("input[required]")].map(i => i.name || i.id)',network:'No request is expected.',conclusion:'The script quickly inventories browser-side mandatory fields; it does not prove backend validation.'},
  C5:{steps:'Create a unique email using the current timestamp.',console:'const email = `qa_${Date.now()}@test.com`;\nconsole.log(email);',network:'No request occurs until the value is used in an API call.',conclusion:'Dynamic values help manual testers create reusable test data without collisions.'},
  C6:{steps:'Click Save demo session, then inspect the stored value from Console.',console:'JSON.parse(localStorage.getItem("qaSession"))',network:'localStorage operations do not require a server request.',conclusion:'Console is useful for investigating browser session state, preferences and cached client data.'},
  C7:{steps:'Search all visible page text for the phrase Out of stock.',console:'document.body.innerText.toLowerCase().includes("out of stock")',network:'No request is expected.',conclusion:'Console can answer simple page-wide checks immediately.'},
  C8:{steps:'Create one policy in the UI, find POST /api/policies in Network, use Copy as fetch, paste it into Console, change the email to a unique value, and run it.',console:'// Best classroom method: Network > POST /api/policies > Copy > Copy as fetch\n// Then change email, e.g.\nemail: `qa_${Date.now()}@test.com`',network:'A new POST /api/policies should appear and return 201 Created.',conclusion:'The policy is test-data setup. If the test target is cancellation or update, creating the precondition via API saves time without replacing the manual test itself.'},
  C9:{steps:'Reuse the create-policy request inside a loop. Make email and plateNumber unique for every iteration.',console:'for (let i=1;i<=5;i++) {\n  const r = await fetch("/api/policies", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({firstName:`QA${i}`,lastName:"Tester",email:`qa_${Date.now()}_${i}@test.com`,phone:"0501234567",idNumber:`9000000${i}`,plateNumber:`QA${Date.now().toString().slice(-5)}${i}`,manufacturer:"Toyota",model:"Corolla",year:2025,startDate:"2026-09-07",coverageType:"COMPREHENSIVE",annualPremium:2490})});\n  console.log(await r.json());\n}',network:'Five POST /api/policies requests should appear, normally each with 201.',conclusion:'A small setup script can create bulk test data for manual tests such as search, sorting, pagination and status handling.'},
  C10:{steps:'Run a create-policy request, await the response, convert it to JSON, and print only id and policyNumber.',console:'const r = await fetch(/* copied create-policy request */);\nconst p = await r.json();\nconsole.log({id:p.id, policyNumber:p.policyNumber});',network:'The POST should return 201 and a Location header containing the new resource URL.',conclusion:'Capturing the returned identifier lets the tester jump directly to follow-up operations on the new test record.'},
  N1:{steps:'Use the successful login button and inspect POST /api/login.',console:'',network:'Method POST; status 200; payload contains email/password; response contains success=true, user and a training token.',conclusion:'The UI action succeeded and the API confirms authentication.'},
  N2:{steps:'Use Failed login and inspect POST /api/login.',console:'',network:'Status 401 with {success:false,message:"Invalid credentials"}. 401 means authentication failed; 403 normally means the identity is known but not permitted.',conclusion:'Status codes help distinguish authentication failure from authorization failure.'},
  N3:{steps:'Trigger Products API or reload the page and inspect GET /api/products.',console:'',network:'GET /api/products returns 200 and count=4.',conclusion:'The response body is the server data source for the product list used in this lab.'},
  N4:{steps:'Compare Trace Smart Watch on the page with product id 102 in GET /api/products.',console:'',network:'The API returns price 159.00 while the UI intentionally displays a different value.',conclusion:'There is a UI/API data mismatch. Evidence should include both the visible price and the API response.'},
  N5:{steps:'Click Trigger 500 and inspect GET /api/broken.',console:'',network:'Status 500. Response includes INTERNAL_SERVER_ERROR and the training message about claims service unavailable.',conclusion:'The request reached the server, but the server failed. A bug report should include endpoint, status and error response.'},
  N6:{steps:'Click Slow API and open the Timing tab for GET /api/slow-report.',console:'',network:'The request should take roughly 2.8 seconds before returning 200.',conclusion:'A request can be functionally successful but still have a performance problem.'},
  N7:{steps:'Create a valid policy through the long UI form and inspect POST /api/policies.',console:'',network:'Status 201 Created; request payload contains the form data; response contains id, policyNumber and ACTIVE; Location points to /api/policies/{id}.',conclusion:'201 is appropriate for resource creation and the response gives the identifier needed for later tests.'},
  N8:{steps:'Copy a successful POST /api/policies as fetch, remove one required field such as plateNumber, then run it from Console.',console:'// From the copied body remove plateNumber completely, then run the fetch again.',network:'POST /api/policies returns 422 with VALIDATION_ERROR and fields listing the missing field.',conclusion:'The backend independently enforces required data even when the normal UI is bypassed.'},
  N9:{steps:'Enter an existing ACTIVE policy ID, change phone/premium and click Update policy.',console:'',network:'PATCH /api/policies/{id}; normally 200 with the updated policy.',conclusion:'Inspecting PATCH shows exactly which fields the client asked to change and what the server accepted.'},
  N10:{steps:'Cancel an ACTIVE policy, then send cancellation again for the same ID.',console:'',network:'First POST /api/policies/{id}/cancel returns 200. Second returns 409 with Policy is already cancelled.',conclusion:'409 represents a business-state conflict: the endpoint exists and the request is valid, but the current resource state does not allow the operation.'},
  F1:{steps:'Reproduce the click. Start with Console for JavaScript errors and Network to see whether a request was sent. Use Elements only if the control state or overlay looks suspicious.',console:'// After reproducing, inspect red errors. Optionally clear first:\nconsole.clear()',network:'If no request appears, investigate frontend behavior. If a request returns 4xx/5xx, investigate payload/response. If 2xx returns but UI does not update, suspect frontend state/rendering.',conclusion:'A strong manual tester narrows the failing layer before reporting “button does not work.”'},
  F2:{steps:'Record the visible product price, inspect the DOM value, then compare with GET /api/products.',console:'document.querySelectorAll(".product")[1].querySelector(".price").innerText',network:'Find product id 102 and compare its price with the UI.',conclusion:'If API is correct and UI is wrong, evidence points toward frontend mapping/rendering. If API itself is wrong, the source may be backend/data.'},
  F3:{steps:'Create an ACTIVE policy via copied fetch, note the returned id, refresh policies, cancel that policy from the UI, then GET the policies list again.',console:'const r = await fetch(/* copied POST /api/policies */);\nconst created = await r.json();\nconsole.log(created.id, created.policyNumber);',network:'Creation should be 201, cancellation 200, and subsequent GET /api/policies should show status CANCELLED.',conclusion:'The script creates only the precondition; the actual cancellation behavior is still tested manually through the UI.'},
  F4:{steps:'Create a policy, cancel it, then try Update policy on the same ID.',console:'',network:'Cancellation returns 200. PATCH afterward returns 409 with Cancelled policy cannot be modified.',conclusion:'The backend enforces the rule that cancelled policies are immutable.'},
  F5:{steps:'Choose one intentional issue such as the product price mismatch. Capture visible UI evidence and the supporting Network request.',console:'',network:'Include Request URL, method, payload if applicable, status, response body and timing when relevant.',conclusion:'A developer-ready bug report explains what the user saw and provides technical evidence that helps locate the failing layer.'}
};

function getBearer(req) {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : '';
}
function validTeacherToken(token) {
  const expiresAt = teacherSessions.get(token);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) { teacherSessions.delete(token); return false; }
  return true;
}

const products = [
  { id: 101, name: 'Focus Pro Headphones', price: 99.99, stock: 12, category: 'Electronics', image: 'headphones' },
  { id: 102, name: 'Trace Smart Watch', price: 159.00, stock: 3, category: 'Electronics', image: 'watch' },
  { id: 103, name: 'Bug Hunter Backpack', price: 59.50, stock: 0, category: 'Work', image: 'backpack' },
  { id: 104, name: 'QA Keyboard', price: 79.00, stock: 8, category: 'Work', image: 'keyboard' }
];

let policies = [];
let nextPolicyId = 58001;

function json(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch (e) { reject(e); }
    });
  });
}

function makePolicy(body) {
  const id = nextPolicyId++;
  return {
    id,
    policyNumber: `POL-${id}`,
    status: 'ACTIVE',
    customer: {
      firstName: body.firstName || '',
      lastName: body.lastName || '',
      email: body.email || '',
      phone: body.phone || '',
      idNumber: body.idNumber || ''
    },
    vehicle: {
      plateNumber: body.plateNumber || '',
      manufacturer: body.manufacturer || '',
      model: body.model || '',
      year: Number(body.year || 0)
    },
    coverage: {
      type: body.coverageType || 'COMPREHENSIVE',
      startDate: body.startDate || '',
      annualPremium: Number(body.annualPremium || 2490)
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function api(req, res, url) {
  if (req.method === 'POST' && url.pathname === '/api/teacher/unlock') {
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { message: 'Invalid JSON' }); }
    if (String(body.pin || '') !== TEACHER_PIN) return json(res, 401, { message: 'Invalid teacher PIN' });
    const token = crypto.randomBytes(24).toString('hex');
    teacherSessions.set(token, Date.now() + TEACHER_SESSION_MS);
    return json(res, 200, { token, expiresInHours: 8 });
  }

  if (req.method === 'GET' && url.pathname === '/api/teacher/solutions') {
    const token = getBearer(req);
    if (!validTeacherToken(token)) return json(res, 401, { message: 'Teacher session required' });
    return json(res, 200, { solutions: teacherSolutions });
  }

  if (req.method === 'POST' && url.pathname === '/api/teacher/lock') {
    const token = getBearer(req);
    if (token) teacherSessions.delete(token);
    return json(res, 200, { success: true });
  }
  if (req.method === 'GET' && url.pathname === '/api/products') {
    return json(res, 200, { count: products.length, products });
  }

  if (req.method === 'GET' && url.pathname === '/api/slow-report') {
    return setTimeout(() => json(res, 200, { ok: true, report: 'Monthly QA report', generatedAt: new Date().toISOString() }), 2800);
  }

  if (req.method === 'GET' && url.pathname === '/api/broken') {
    return json(res, 500, { error: 'INTERNAL_SERVER_ERROR', message: 'Intentional training error: claims service unavailable' });
  }

  if (req.method === 'POST' && url.pathname === '/api/login') {
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { message: 'Invalid JSON' }); }
    if (body.email === 'student@goodquality.test' && body.password === 'QaStudent123') {
      return json(res, 200, { success: true, user: { id: 17, name: 'QA Student', role: 'tester' }, token: 'training-token-qa-17' });
    }
    return json(res, 401, { success: false, message: 'Invalid credentials' });
  }

  if (req.method === 'GET' && url.pathname === '/api/policies') {
    return json(res, 200, { count: policies.length, policies: policies.slice().reverse() });
  }

  if (req.method === 'POST' && url.pathname === '/api/policies') {
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { message: 'Invalid JSON' }); }
    const required = ['firstName','lastName','email','phone','idNumber','plateNumber','manufacturer','model','year','startDate'];
    const missing = required.filter(k => body[k] === undefined || body[k] === null || String(body[k]).trim() === '');
    if (missing.length) return json(res, 422, { error: 'VALIDATION_ERROR', message: 'Missing required fields', fields: missing });
    if (!String(body.email).includes('@')) return json(res, 422, { error: 'VALIDATION_ERROR', message: 'Invalid email' });
    if (Number(body.year) < 1990 || Number(body.year) > 2027) return json(res, 422, { error: 'VALIDATION_ERROR', message: 'Vehicle year out of range' });
    const policy = makePolicy(body);
    policies.push(policy);
    return json(res, 201, policy, { 'Location': `/api/policies/${policy.id}` });
  }

  const match = url.pathname.match(/^\/api\/policies\/(\d+)(?:\/(cancel))?$/);
  if (match) {
    const id = Number(match[1]);
    const action = match[2];
    const policy = policies.find(p => p.id === id);
    if (!policy) return json(res, 404, { message: 'Policy not found' });

    if (req.method === 'GET' && !action) return json(res, 200, policy);

    if (req.method === 'PATCH' && !action) {
      let body;
      try { body = await readBody(req); } catch { return json(res, 400, { message: 'Invalid JSON' }); }
      if (policy.status === 'CANCELLED') return json(res, 409, { message: 'Cancelled policy cannot be modified' });
      if (body.phone !== undefined) policy.customer.phone = String(body.phone);
      if (body.annualPremium !== undefined) policy.coverage.annualPremium = Number(body.annualPremium);
      if (body.startDate !== undefined) policy.coverage.startDate = String(body.startDate);
      policy.updatedAt = new Date().toISOString();
      return json(res, 200, policy);
    }

    if (req.method === 'POST' && action === 'cancel') {
      if (policy.status === 'CANCELLED') return json(res, 409, { message: 'Policy is already cancelled' });
      policy.status = 'CANCELLED';
      policy.cancelledAt = new Date().toISOString();
      policy.updatedAt = policy.cancelledAt;
      return json(res, 200, { success: true, policy });
    }
  }

  json(res, 404, { message: 'API route not found' });
}

function serveStatic(req, res, url) {
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.join(ROOT, requested.replace(/^\/+/, ''));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath);
    const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control':'no-store' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`GQ DevTools Lab running at http://localhost:${PORT}`);
});
