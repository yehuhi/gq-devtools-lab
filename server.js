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
  QF1:{steps:'Create a customer once through the UI. In Network, open POST /api/customers, Copy as fetch, run it in Console, then wrap the working request in async function createCustomer(). Keep the original values fixed for this first version.',console:'async function createCustomer() {\n  const r = await fetch("/api/customers", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({firstName:"QA",lastName:"Customer",email:`qa_${Date.now()}@test.com`,phone:"0507654321",dateOfBirth:"1995-04-12"})});\n  const customer = await r.json();\n  console.log(customer);\n  return customer;\n}',network:'Each call should send POST /api/customers and return 201 Created.',conclusion:'First prove that the copied request works. Only then refactor it into a reusable helper.'},
  QF2:{steps:'Take the working createCustomer() from QF1. Add firstName and lastName inside the parentheses and replace only the matching fixed values in the body.',console:'async function createCustomer(firstName, lastName) {\n  const r = await fetch("/api/customers", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({firstName:firstName,lastName:lastName,email:`qa_${Date.now()}@test.com`,phone:"0507654321",dateOfBirth:"1995-04-12"})});\n  const customer = await r.json();\n  return customer;\n}\n\n// Examples:\nawait createCustomer("Dana", "Levi");\nawait createCustomer("Daniel", "Cohen");',network:'The endpoint stays the same. Compare Payload values between calls and verify that the names change.',conclusion:'A parameter replaces a hard-coded value so the same helper can create different test data.'},
  QF3:{steps:'Create a policy through the UI. Find POST /api/policies, Copy as fetch, verify it, then wrap that exact request in createPolicy() using fixed values first.',console:'async function createPolicy() {\n  const r = await fetch("/api/policies", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({firstName:"QA",lastName:"Student",email:`qa_${Date.now()}@test.com`,phone:"0501234567",coverageType:"COMPREHENSIVE",vehicleNumber:"12345678",premium:3200})});\n  const policy = await r.json();\n  console.log(policy);\n  return policy;\n}',network:'POST /api/policies should return 201 Created. Inspect the request Payload and response id/policyNumber/status.',conclusion:'Build the fixed working version before making it dynamic.'},
  QF4:{steps:'Modify createPolicy() from QF3. Add firstName and coverageType as parameters and replace only those two fixed values in the Payload.',console:'async function createPolicy(firstName, coverageType) {\n  const r = await fetch("/api/policies", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({firstName, lastName:"Student",email:`qa_${Date.now()}@test.com`,phone:"0501234567",coverageType,vehicleNumber:"12345678",premium:3200})});\n  const policy = await r.json();\n  return policy;\n}\n\nawait createPolicy("Dana", "THIRD_PARTY");\nawait createPolicy("Daniel", "COMPREHENSIVE");',network:'Compare two POST /api/policies requests and verify that firstName and coverageType change in Payload.',conclusion:'Only values that need to vary should become parameters. Keep the helper simple.'},
  QF5:{steps:'Add default values in the function declaration so the helper works both with no arguments and with custom arguments.',console:'async function createPolicy(firstName = "QA", coverageType = "COMPREHENSIVE") {\n  const r = await fetch("/api/policies", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({firstName,lastName:"Student",email:`qa_${Date.now()}@test.com`,phone:"0501234567",coverageType,vehicleNumber:"12345678",premium:3200})});\n  const policy = await r.json();\n  return policy;\n}\n\nawait createPolicy();\nawait createPolicy("Noa", "THIRD_PARTY");',network:'Both calls should return 201. The first uses defaults; the second should contain custom Payload values.',conclusion:'Default parameters make a helper fast for common setup while still allowing custom test data.'},
  QF6:{steps:'Submit one claim through the UI. Copy POST /api/claims as fetch and make a fixed createClaim() first. Then add policyId, claimType and amount parameters.',console:'async function createClaim(policyId, claimType = "ACCIDENT", amount = 3500) {\n  const r = await fetch("/api/claims", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({policyId,claimType,description:"QA test claim",estimatedAmount:amount})});\n  const claim = await r.json();\n  return claim;\n}',network:'POST /api/claims should return 201 for a valid ACTIVE policy. Inspect policyId, claimType and estimatedAmount in Payload.',conclusion:'The same request pattern can become a reusable helper for a different business object.'},
  QF7:{steps:'Record a payment in the UI. Copy POST /api/payments as fetch. First prove the fixed request works, then turn policyId and amount into parameters.',console:'async function createPayment(policyId, amount) {\n  const r = await fetch("/api/payments", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({policyId,amount,paymentMethod:"CARD"})});\n  return await r.json();\n}',network:'POST /api/payments should return 201. Verify different calls send different amount values.',conclusion:'Parameters let one helper prepare multiple realistic payment scenarios without editing the source each time.'},
  QF8:{steps:'Update one policy from the UI. Copy the PATCH request, build a fixed updatePolicy() first, then add id and premium parameters.',console:'async function updatePolicy(id, premium) {\n  const r = await fetch(`/api/policies/${id}`, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({premium})});\n  const updated = await r.json();\n  console.log(updated);\n  return updated;\n}',network:'PATCH /api/policies/:id should show the selected id in the URL and premium in the Payload.',conclusion:'Parameters can affect both the request URL and request body.'},
  QF9:{steps:'Cancel a policy through the UI and convert that request into cancelPolicy(id). Then use GET /api/policies/:id to build getPolicy(id) and verify the status after cancellation.',console:'async function cancelPolicy(id) {\n  const r = await fetch(`/api/policies/${id}/cancel`, {method:"POST"});\n  return await r.json();\n}\nasync function getPolicy(id) {\n  const r = await fetch(`/api/policies/${id}`);\n  return await r.json();\n}',network:'Cancellation should return 200 for an ACTIVE policy. The following GET should return the same policy with status CANCELLED.',conclusion:'Small helpers can be chained: one changes state and another verifies the resulting data.'},
  QF10:{steps:'Create createCustomers(amount) or createPolicies(amount). Reuse the helper you already wrote instead of duplicating its fetch code.',console:'async function createPolicies(amount) {\n  const created = [];\n  for (let i = 0; i < amount; i++) {\n    created.push(await createPolicy(`QA${i+1}`, "COMPREHENSIVE"));\n  }\n  return created;\n}\n\nawait createPolicies(10);',network:'You should see one POST request per created record. Use Network to confirm the number of requests and statuses.',conclusion:'A loop plus a reusable helper is useful for setup such as pagination, search and sorting tests.'},
  QF11:{steps:'Combine createPolicy() and cancelPolicy(id) into one helper that prepares the exact precondition needed for tests requiring a cancelled policy.',console:'async function createCancelledPolicy() {\n  const policy = await createPolicy();\n  const cancelled = await cancelPolicy(policy.id);\n  return cancelled;\n}\n\nconst cancelledPolicy = await createCancelledPolicy();',network:'You should see POST /api/policies followed by POST /api/policies/:id/cancel.',conclusion:'A precondition helper prepares test data efficiently. It does not replace the manual test of the feature under test.'},
  QF12:{steps:'Open Sources > Snippets > New snippet. Name it GQ QA Toolkit. Paste the FINAL parameterized versions of createCustomer, createPolicy, createClaim, createPayment, updatePolicy, cancelPolicy, getPolicy, createPolicies and createCancelledPolicy. Save and run the Snippet. After Refresh, run the Snippet again before calling functions.',console:'// The Snippet should define your final reusable helpers.\n// Example calls after running it:\nawait createCustomer("Dana", "Levi");\nconst p = await createPolicy("Noa", "THIRD_PARTY");\nawait createPayment(p.id, 750);\nawait createClaim(p.id, "ACCIDENT", 4200);\nawait updatePolicy(p.id, 3900);',network:'Running the Snippet only defines functions unless you call one at the bottom. Each helper call should create its corresponding Network request.',conclusion:'The progression is: copied request -> fixed function -> parameters/defaults -> reusable QA Toolkit stored as a Snippet.'},
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
let customers = []; let nextCustomerId = 41001;
let claims = []; let nextClaimId = 71001;
let payments = []; let nextPaymentId = 81001;

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

  if (req.method === 'GET' && url.pathname === '/api/customers') return json(res, 200, { count: customers.length, customers: customers.slice().reverse() });
  if (req.method === 'POST' && url.pathname === '/api/customers') {
    let body; try { body = await readBody(req); } catch { return json(res,400,{message:'Invalid JSON'}); }
    const required=['firstName','lastName','email','phone','dateOfBirth']; const missing=required.filter(k=>!String(body[k]||'').trim());
    if(missing.length) return json(res,422,{error:'VALIDATION_ERROR',message:'Missing required fields',fields:missing});
    if(!String(body.email).includes('@')) return json(res,422,{error:'VALIDATION_ERROR',message:'Invalid email'});
    if(customers.some(c=>c.email===body.email)) return json(res,409,{error:'DUPLICATE_EMAIL',message:'Customer email already exists'});
    const id=nextCustomerId++; const customer={id,customerNumber:`CUS-${id}`,firstName:body.firstName,lastName:body.lastName,email:body.email,phone:body.phone,dateOfBirth:body.dateOfBirth,createdAt:new Date().toISOString()}; customers.push(customer);
    return json(res,201,customer,{'Location':`/api/customers/${id}`});
  }

  if (req.method === 'GET' && url.pathname === '/api/claims') return json(res,200,{count:claims.length,claims:claims.slice().reverse()});
  if (req.method === 'POST' && url.pathname === '/api/claims') {
    let body; try { body=await readBody(req); } catch { return json(res,400,{message:'Invalid JSON'}); }
    const policy=policies.find(p=>p.id===Number(body.policyId)); if(!policy) return json(res,404,{message:'Policy not found'});
    if(policy.status==='CANCELLED') return json(res,409,{message:'Cannot submit a claim for a cancelled policy'});
    if(!body.claimType || !body.description || Number(body.estimatedAmount)<=0) return json(res,422,{error:'VALIDATION_ERROR',message:'Claim type, description and positive amount are required'});
    const id=nextClaimId++; const claim={id,claimNumber:`CLM-${id}`,policyId:policy.id,claimType:body.claimType,description:body.description,estimatedAmount:Number(body.estimatedAmount),status:'OPEN',createdAt:new Date().toISOString()}; claims.push(claim);
    return json(res,201,claim,{'Location':`/api/claims/${id}`});
  }

  if (req.method === 'GET' && url.pathname === '/api/payments') return json(res,200,{count:payments.length,payments:payments.slice().reverse()});
  if (req.method === 'POST' && url.pathname === '/api/payments') {
    let body; try { body=await readBody(req); } catch { return json(res,400,{message:'Invalid JSON'}); }
    const policy=policies.find(p=>p.id===Number(body.policyId)); if(!policy) return json(res,404,{message:'Policy not found'});
    if(Number(body.amount)<=0) return json(res,422,{error:'VALIDATION_ERROR',message:'Payment amount must be greater than zero'});
    const id=nextPaymentId++; const payment={id,paymentNumber:`PAY-${id}`,policyId:policy.id,amount:Number(body.amount),paymentMethod:body.paymentMethod||'CARD',status:'PAID',createdAt:new Date().toISOString()}; payments.push(payment);
    return json(res,201,payment,{'Location':`/api/payments/${id}`});
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
  // CORS: the frontend (e.g. on Netlify) is served from a different origin
  // than this API (Railway), so cross-origin requests need explicit headers.
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`GQ DevTools Lab running at http://localhost:${PORT}`);
});
