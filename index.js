const KEYS = {
    biz: 'invoice-maker-biz',
    docs: 'invoice-maker-docs',
    counters: 'invoice-maker-counters'
};

const $ = (id) => document.getElementById(id);

/* ---------- storage ---------- */
function load(key, fallback) {
    try {
        const v = JSON.parse(localStorage.getItem(key));
        return v === null || v === undefined ? fallback : v;
    } catch (e) {
        return fallback;
    }
}

function save(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        alert('Could not save. Your browser storage may be full or blocked.');
        return false;
    }
}

/* ---------- helpers ---------- */
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function pad(n, len) { return String(n).padStart(len || 2, '0'); }

function todayString() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDate(str) {
    if (!str) return '-';
    const d = new Date(str + 'T00:00:00');
    return isNaN(d) ? str : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function round2(n) { return Math.round(n * 100) / 100; }

function naira(n) {
    return '₦' + Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
}

const PREFIX = { invoice: 'INV-', receipt: 'RCT-' };

function nextNumber(type) {
    const c = load(KEYS.counters, { invoice: 0, receipt: 0 });
    return PREFIX[type] + pad((c[type] || 0) + 1, 4);
}

function bumpCounter(type, number) {
    const m = String(number).match(/(\d+)\s*$/);
    if (!m) return;
    const c = load(KEYS.counters, { invoice: 0, receipt: 0 });
    c[type] = Math.max(c[type] || 0, parseInt(m[1], 10));
    save(KEYS.counters, c);
}

/* ---------- document state ---------- */
function blankDoc(type) {
    const biz = load(KEYS.biz, {});
    return {
        id: null,
        type: type,
        number: nextNumber(type),
        date: todayString(),
        due: '',
        method: 'Bank transfer',
        client: { name: '', address: '', phone: '' },
        items: [{ id: uid(), desc: '', qty: 1, price: 0 }],
        discount: 0,
        vatOn: false,
        vatRate: 7.5,
        paid: '',
        notes: 'Thank you for your business.',
        biz: Object.assign(
            { name: '', address: '', phone: '', email: '', logo: '', bankName: '', accName: '', accNumber: '' },
            biz
        )
    };
}

let doc = blankDoc('invoice');

/* ---------- calculations ---------- */
function totals() {
    const subtotal = round2(doc.items.reduce((s, i) => s + i.qty * i.price, 0));
    const discount = Math.min(Math.max(Number(doc.discount) || 0, 0), subtotal);
    const taxable = round2(subtotal - discount);
    const vat = doc.vatOn ? round2(taxable * (Number(doc.vatRate) || 0) / 100) : 0;
    const total = round2(taxable + vat);

    let paid;
    if (doc.paid === '' || doc.paid === null) paid = doc.type === 'receipt' ? total : 0;
    else paid = Math.max(Number(doc.paid) || 0, 0);

    return { subtotal, discount, vat, total, paid, balance: round2(total - paid) };
}

/* ---------- form <-> state ---------- */
function fillForm() {
    $('docType').value = doc.type;
    $('docNumber').value = doc.number;
    $('docDate').value = doc.date;
    $('docDue').value = doc.due;
    $('payMethod').value = doc.method;

    $('bizName').value = doc.biz.name;
    $('bizAddress').value = doc.biz.address;
    $('bizPhone').value = doc.biz.phone;
    $('bizEmail').value = doc.biz.email;
    $('removeLogoBtn').hidden = !doc.biz.logo;

    $('clientName').value = doc.client.name;
    $('clientAddress').value = doc.client.address;
    $('clientPhone').value = doc.client.phone;

    $('discount').value = doc.discount;
    $('amountPaid').value = doc.paid;
    $('vatOn').checked = doc.vatOn;
    $('vatRate').value = doc.vatRate;

    $('bankName').value = doc.biz.bankName;
    $('accName').value = doc.biz.accName;
    $('accNumber').value = doc.biz.accNumber;
    $('notes').value = doc.notes;

    renderItems();
    updateVisibility();
}

function readForm() {
    doc.type = $('docType').value;
    doc.number = $('docNumber').value.trim();
    doc.date = $('docDate').value;
    doc.due = $('docDue').value;
    doc.method = $('payMethod').value;

    doc.biz.name = $('bizName').value.trim();
    doc.biz.address = $('bizAddress').value.trim();
    doc.biz.phone = $('bizPhone').value.trim();
    doc.biz.email = $('bizEmail').value.trim();
    doc.biz.bankName = $('bankName').value.trim();
    doc.biz.accName = $('accName').value.trim();
    doc.biz.accNumber = $('accNumber').value.trim();

    doc.client.name = $('clientName').value.trim();
    doc.client.address = $('clientAddress').value.trim();
    doc.client.phone = $('clientPhone').value.trim();

    doc.items = Array.from(document.querySelectorAll('.item-row')).map((row) => ({
        id: row.dataset.id,
        desc: row.querySelector('.i-desc').value,
        qty: Number(row.querySelector('.i-qty').value) || 0,
        price: Number(row.querySelector('.i-price').value) || 0
    }));

    doc.discount = $('discount').value;
    doc.paid = $('amountPaid').value;
    doc.vatOn = $('vatOn').checked;
    doc.vatRate = $('vatRate').value;
    doc.notes = $('notes').value.trim();

    // update line amounts shown in the form
    document.querySelectorAll('.item-row').forEach((row, i) => {
        row.querySelector('.i-amount').textContent = naira(round2(doc.items[i].qty * doc.items[i].price));
    });

    save(KEYS.biz, doc.biz);
}

function updateVisibility() {
    const isReceipt = doc.type === 'receipt';
    $('dueRow').hidden = isReceipt;
    $('methodRow').hidden = !isReceipt;
    $('clientTitle').textContent = isReceipt ? 'Received from' : 'Bill to';
    $('vatRow').hidden = !doc.vatOn;
    $('paidHint').textContent = isReceipt
        ? 'Leave empty to mark the full total as paid.'
        : 'Leave empty if nothing has been paid yet.';
}

/* ---------- items ---------- */
function renderItems() {
    const box = $('itemsBox');
    box.textContent = '';
    if (doc.items.length === 0) doc.items.push({ id: uid(), desc: '', qty: 1, price: 0 });

    doc.items.forEach((item) => {
        const row = el('div', 'item-row');
        row.dataset.id = item.id;

        const desc = el('input', 'i-desc');
        desc.type = 'text';
        desc.placeholder = 'Item or service';
        desc.value = item.desc;
        desc.setAttribute('aria-label', 'Description');

        const qty = el('input', 'i-qty');
        qty.type = 'number';
        qty.min = '0';
        qty.step = 'any';
        qty.value = item.qty;
        qty.setAttribute('aria-label', 'Quantity');

        const price = el('input', 'i-price');
        price.type = 'number';
        price.min = '0';
        price.step = 'any';
        price.value = item.price;
        price.placeholder = 'Price';
        price.setAttribute('aria-label', 'Unit price');

        const amount = el('span', 'i-amount', naira(round2(item.qty * item.price)));

        const del = el('button', 'small danger i-remove', 'Remove');
        del.type = 'button';

        row.append(desc, qty, price, amount, del);
        box.appendChild(row);
    });
}

$('addItemBtn').addEventListener('click', function () {
    readForm();
    doc.items.push({ id: uid(), desc: '', qty: 1, price: 0 });
    renderItems();
    renderPreview();
    const rows = document.querySelectorAll('.item-row');
    rows[rows.length - 1].querySelector('.i-desc').focus();
});

$('itemsBox').addEventListener('click', function (e) {
    if (!e.target.classList.contains('i-remove')) return;
    readForm();
    const id = e.target.closest('.item-row').dataset.id;
    doc.items = doc.items.filter((i) => i.id !== id);
    renderItems();
    renderPreview();
});

/* ---------- events ---------- */
$('formArea').addEventListener('input', function (e) {
    if (e.target.id === 'bizLogo') return;
    readForm();
    updateVisibility();
    renderPreview();
});

$('docType').addEventListener('change', function () {
    // give a fresh number of the new type if this document is not saved yet
    if (!doc.id) {
        doc.number = nextNumber($('docType').value);
        $('docNumber').value = doc.number;
    }
    readForm();
    updateVisibility();
    renderPreview();
});

// logo upload (resized to keep storage small)
$('bizLogo').addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        alert('Please choose an image file.');
        return;
    }
    const reader = new FileReader();
    reader.onload = function () {
        const img = new Image();
        img.onload = function () {
            const max = 240;
            const scale = Math.min(1, max / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            readForm();
            doc.biz.logo = canvas.toDataURL('image/png');
            save(KEYS.biz, doc.biz);
            $('removeLogoBtn').hidden = false;
            renderPreview();
        };
        img.onerror = function () { alert('That image could not be read.'); };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
});

$('removeLogoBtn').addEventListener('click', function () {
    doc.biz.logo = '';
    $('bizLogo').value = '';
    this.hidden = true;
    save(KEYS.biz, doc.biz);
    renderPreview();
});

/* ---------- preview ---------- */
function metaLine(label, value) {
    const p = el('p', 'meta-line');
    p.append(el('span', 'meta-label', label + ': '), el('strong', '', value));
    return p;
}

function totalRow(label, value, cls) {
    const row = el('div', 'tot-row' + (cls ? ' ' + cls : ''));
    row.append(el('span', '', label), el('strong', '', value));
    return row;
}

function renderPreview() {
    const t = totals();
    const isReceipt = doc.type === 'receipt';
    const p = $('preview');
    p.textContent = '';

    /* header */
    const head = el('div', 'p-head');

    const left = el('div', 'p-biz');
    if (doc.biz.logo) {
        const img = el('img', 'p-logo');
        img.src = doc.biz.logo;
        img.alt = 'Business logo';
        left.appendChild(img);
    }
    left.appendChild(el('h2', '', doc.biz.name || 'Your business name'));
    if (doc.biz.address) left.appendChild(el('p', 'pre', doc.biz.address));
    const contact = [doc.biz.phone, doc.biz.email].filter(Boolean).join(' • ');
    if (contact) left.appendChild(el('p', '', contact));

    const right = el('div', 'p-meta');
    right.appendChild(el('h1', '', isReceipt ? 'RECEIPT' : 'INVOICE'));
    right.appendChild(metaLine('No.', doc.number || '-'));
    right.appendChild(metaLine('Date', fmtDate(doc.date)));
    if (!isReceipt && doc.due) right.appendChild(metaLine('Due', fmtDate(doc.due)));
    if (isReceipt) right.appendChild(metaLine('Method', doc.method));

    head.append(left, right);
    p.appendChild(head);

    /* client */
    const client = el('div', 'p-client');
    client.appendChild(el('h3', '', isReceipt ? 'Received from' : 'Bill to'));
    client.appendChild(el('p', 'strong', doc.client.name || 'Customer name'));
    if (doc.client.address) client.appendChild(el('p', 'pre', doc.client.address));
    if (doc.client.phone) client.appendChild(el('p', '', doc.client.phone));
    p.appendChild(client);

    /* items table */
    const wrap = el('div', 'table-wrap');
    const table = el('table');
    const thead = el('thead');
    const hr = el('tr');
    ['#', 'Description', 'Qty', 'Unit price', 'Amount'].forEach((h, i) => {
        const th = el('th', i >= 2 ? 'num' : '', h);
        hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = el('tbody');
    const shown = doc.items.filter((i) => i.desc.trim() !== '' || i.qty * i.price > 0);
    if (shown.length === 0) {
        const tr = el('tr');
        const td = el('td', 'muted center', 'No items yet');
        td.colSpan = 5;
        tr.appendChild(td);
        tbody.appendChild(tr);
    }
    shown.forEach((item, idx) => {
        const tr = el('tr');
        tr.appendChild(el('td', '', String(idx + 1)));
        tr.appendChild(el('td', 'pre', item.desc));
        tr.appendChild(el('td', 'num', String(item.qty)));
        tr.appendChild(el('td', 'num', naira(item.price)));
        tr.appendChild(el('td', 'num', naira(round2(item.qty * item.price))));
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    p.appendChild(wrap);

    /* totals */
    const tots = el('div', 'p-totals');
    tots.appendChild(totalRow('Subtotal', naira(t.subtotal)));
    if (t.discount > 0) tots.appendChild(totalRow('Discount', '-' + naira(t.discount)));
    if (doc.vatOn) tots.appendChild(totalRow(`VAT (${Number(doc.vatRate) || 0}%)`, naira(t.vat)));
    tots.appendChild(totalRow('Total', naira(t.total), 'grand'));
    if (t.paid > 0) tots.appendChild(totalRow('Amount paid', naira(t.paid)));
    if (!isReceipt || t.balance > 0) {
        tots.appendChild(totalRow(isReceipt ? 'Balance remaining' : 'Balance due', naira(Math.max(t.balance, 0)), 'balance'));
    }
    p.appendChild(tots);

    /* status stamp */
    let stamp = '';
    if (t.total > 0 && t.balance <= 0) stamp = isReceipt ? 'PAID IN FULL' : 'PAID';
    else if (isReceipt && t.paid > 0) stamp = 'PART PAYMENT';
    if (stamp) p.appendChild(el('div', 'stamp', stamp));

    /* payment details */
    const hasBank = doc.biz.bankName || doc.biz.accName || doc.biz.accNumber;
    if (!isReceipt && hasBank) {
        const pay = el('div', 'p-pay');
        pay.appendChild(el('h3', '', 'Payment details'));
        if (doc.biz.bankName) pay.appendChild(el('p', '', 'Bank: ' + doc.biz.bankName));
        if (doc.biz.accName) pay.appendChild(el('p', '', 'Account name: ' + doc.biz.accName));
        if (doc.biz.accNumber) pay.appendChild(el('p', '', 'Account number: ' + doc.biz.accNumber));
        p.appendChild(pay);
    }

    /* notes */
    if (doc.notes) {
        const notes = el('div', 'p-notes');
        notes.appendChild(el('h3', '', 'Notes'));
        notes.appendChild(el('p', 'pre', doc.notes));
        p.appendChild(notes);
    }
}

/* ---------- print ---------- */
$('printBtn').addEventListener('click', function () {
    readForm();
    const oldTitle = document.title;
    document.title = `${doc.type}-${doc.number || 'document'}`;
    window.onafterprint = function () {
        document.title = oldTitle;
        window.onafterprint = null;
    };
    window.print();
});

/* ---------- saved documents ---------- */
function getDocs() { return load(KEYS.docs, []); }

$('saveBtn').addEventListener('click', function () {
    readForm();
    if (!doc.number) {
        alert('Please give the document a number first.');
        return;
    }
    const docs = getDocs();
    if (!doc.id) doc.id = uid();
    const t = totals();
    const record = JSON.parse(JSON.stringify(doc));
    record.savedTotal = t.total;
    record.savedAt = todayString();

    const i = docs.findIndex((d) => d.id === doc.id);
    if (i >= 0) docs[i] = record;
    else docs.push(record);

    if (save(KEYS.docs, docs)) {
        bumpCounter(doc.type, doc.number);
        renderSaved();
    }
});

$('newBtn').addEventListener('click', function () {
    doc = blankDoc($('docType').value);
    fillForm();
    renderPreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

function loadDoc(id) {
    const found = getDocs().find((d) => d.id === id);
    if (!found) return;
    doc = JSON.parse(JSON.stringify(found));
    fillForm();
    renderPreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteDoc(id) {
    if (!confirm('Delete this saved document?')) return;
    const docs = getDocs().filter((d) => d.id !== id);
    save(KEYS.docs, docs);
    if (doc.id === id) doc.id = null;
    renderSaved();
}

function renderSaved() {
    const list = $('savedList');
    list.textContent = '';
    const docs = getDocs().slice().reverse();
    $('noSaved').hidden = docs.length > 0;

    docs.forEach((d) => {
        const li = el('li', 'saved');
        const info = el('div', 'info');
        info.appendChild(el('strong', '', `${d.type === 'receipt' ? 'Receipt' : 'Invoice'} ${d.number}`));
        info.appendChild(el('small', '', `${d.client.name || 'No customer'} • ${naira(d.savedTotal || 0)} • ${fmtDate(d.date)}`));

        const btns = el('div', 'btns');
        const open = el('button', 'small ok', 'Open');
        open.type = 'button';
        open.addEventListener('click', () => loadDoc(d.id));
        const del = el('button', 'small danger', 'Delete');
        del.type = 'button';
        del.addEventListener('click', () => deleteDoc(d.id));
        btns.append(open, del);

        li.append(info, btns);
        list.appendChild(li);
    });
}

/* ---------- start ---------- */
fillForm();
renderPreview();
renderSaved();
