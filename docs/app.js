(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);

/* ---------- state ---------- */
const drives = [
  { id: 'd1', name: 'SanDisk Ultra', dev: '/dev/sdb', gb: 64, fs: 'exFAT', used: 0.42, health: 94, status: 'connected', speed: [138, 62] },
  { id: 'd2', name: 'Kingston DataTraveler', dev: '/dev/sdc', gb: 32, fs: 'FAT32', used: 0.78, health: 71, status: 'connected', speed: [92, 28] },
  { id: 'd3', name: 'Samsung BAR Plus', dev: '/dev/sdd', gb: 128, fs: 'NTFS', used: 0.15, health: 99, status: 'connected', speed: [310, 140] },
];
const state = { drive: null, fs: 'exFAT', method: 'quick', busy: false, isos: [], abort: false };
const SW = ['#fff', '#cfcfcf', '#9a9a9a', '#6e6e6e', '#e6e6e6', '#b4b4b4'];

/* ---------- console ---------- */
const logs = $('#logs'), consoleEl = $('#console');
const ts = () => new Date().toTimeString().slice(0, 8);
function log(msg, cls = '') {
  const d = document.createElement('div');
  d.innerHTML = `<span class="t">${ts()}</span><span class="${cls}"></span>`;
  d.lastChild.textContent = msg;
  logs.append(d);
  logs.scrollTop = logs.scrollHeight;
  $('#consoleLast').textContent = msg;
}
$('#consoleToggle').onclick = () => consoleEl.classList.toggle('open');
const openConsole = () => consoleEl.classList.add('open');
log('USB Multitool ready. Simulation mode active.');

function toast(t) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = t;
  $('#toasts').append(el);
  setTimeout(() => { el.style.opacity = 0; el.style.transition = '.4s'; setTimeout(() => el.remove(), 400); }, 2600);
}

/* ---------- modal ---------- */
function confirmModal({ title, body, word }) {
  return new Promise(res => {
    const m = $('#modal'), inp = $('#mInput'), ok = $('#mOk');
    $('#mTitle').textContent = title; $('#mBody').textContent = body;
    $('#mConfirmWrap').style.display = word ? 'grid' : 'none';
    $('#mWord').textContent = word || ''; inp.value = '';
    ok.disabled = !!word;
    const done = v => { m.classList.remove('show'); m.setAttribute('aria-hidden', 'true'); ok.onclick = $('#mCancel').onclick = inp.oninput = null; res(v); };
    inp.oninput = () => ok.disabled = inp.value.trim().toUpperCase() !== word;
    ok.onclick = () => done(true); $('#mCancel').onclick = () => done(false);
    m.classList.add('show'); m.setAttribute('aria-hidden', 'false');
    setTimeout(() => (word ? inp : ok).focus(), 100);
  });
}
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') $('#mCancel').click(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal').classList.contains('show')) $('#mCancel').click(); });

/* ---------- navigation ---------- */
const titles = { hub: 'Select a target drive', health: 'Health and diagnostics', format: 'Format and clean', iso: 'Multiboot ISO manager' };
const numbers = { hub: '01 / Drive hub', health: '02 / Diagnostics', format: '03 / Format and clean', iso: '04 / Multiboot' };
function go(v) {
  if (v !== 'hub' && !state.drive) { toast('Select a drive first'); v = 'hub'; }
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $$('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  $('#title').textContent = titles[v]; $('#crumb').textContent = numbers[v];
  $('#view-' + v).querySelectorAll('.reveal').forEach(el => { el.classList.remove('in'); io.observe(el); });
  $('main').scrollTop = 0;
  if (v === 'health') showHealth();
  if (v === 'iso') renderIso();
}
$$('.nav-item').forEach(b => b.onclick = () => go(b.dataset.view));
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { root: $('main'), threshold: .08 });
$$('.reveal').forEach(el => io.observe(el));

/* ---------- drive hub ---------- */
const stText = d => ({ connected: 'Connected', healthy: 'Healthy', formatting: 'Formatting', scanning: 'Scanning', wiping: 'Wiping' }[d.status] || d.status);
function renderDrives() {
  const g = $('#driveGrid'); g.innerHTML = '';
  drives.forEach((d, i) => {
    const el = document.createElement('div');
    el.className = 'card drive reveal' + (state.drive === d ? ' sel' : '');
    el.style.transitionDelay = i * 80 + 'ms';
    const busy = ['formatting', 'scanning', 'wiping'].includes(d.status);
    el.innerHTML = `<div class="name">${d.name}</div>
      <div class="meta mono">${d.dev} · ${d.gb} GB · ${d.fs}</div>
      <div class="status"><span class="dot ${busy ? 'busy' : 'live'}"></span>${stText(d)}</div>
      <div class="usage"><i style="width:${d.used * 100}%"></i></div>
      <div class="meta mono" style="margin:8px 0 0">${Math.round(d.used * d.gb)} of ${d.gb} GB used</div>`;
    el.onclick = () => selectDrive(d);
    g.append(el); requestAnimationFrame(() => el.classList.add('in'));
  });
}
function selectDrive(d) {
  if (state.busy) return toast('Wait for the current task');
  state.drive = d; state.fs = d.fs; renderDrives(); renderChip(); renderFs();
  log(`Selected ${d.name} (${d.dev}), ${d.gb} GB ${d.fs}`);
  toast(d.name + ' selected');
}
function renderChip() {
  const d = state.drive;
  $('#targetChip').innerHTML = d ? `<span class="dot live"></span>${d.name} · ${d.dev}` : '<span class="dot off"></span>No drive selected';
}
$('#rescan').onclick = async e => {
  const b = e.currentTarget; b.classList.add('busy'); openConsole();
  log('Scanning USB ports...', 'cur'); await sleep(900);
  log(`Found ${drives.length} removable devices`); b.classList.remove('busy');
};

/* ---------- health ---------- */
function setRing(arc, num, v, max) {
  $(arc).style.strokeDashoffset = 264 - 264 * Math.min(v / max, 1); $(num).textContent = Math.round(v);
}
function showHealth() {
  const d = state.drive; if (!d) return;
  $('#healthArc').style.strokeDashoffset = 100 - d.health;
  const n = $('#healthNum'); let c = 0;
  const t = setInterval(() => { c += 2; n.textContent = Math.min(c, d.health); if (c >= d.health) clearInterval(t); }, 14);
  const temp = Math.round(rand(31, 42));
  $('#smart').innerHTML = [
    ['Reallocated sectors', d.health > 90 ? '0' : '12'], ['Wear levelling', d.health + '%'],
    ['Power cycles', Math.round(rand(80, 900))], ['Temperature', temp + ' °C'], ['SMART status', 'PASSED'],
  ].map(([a, b]) => `<div><span>${a}</span><span class="mono">${b}</span></div>`).join('');
  buildBlocks();
}
function buildBlocks() {
  $('#blocks').innerHTML = Array.from({ length: 240 }, () => '<i></i>').join('');
  $('#scanBar').style.width = 0; $('#scanStat').textContent = 'Idle';
}
$('#speedBtn').onclick = async e => {
  if (state.busy) return;
  const d = state.drive; state.busy = true; e.target.disabled = true; openConsole();
  log(`Benchmark started on ${d.dev}`);
  for (const [k, arc, num, max, v] of [['read', '#rdArc', '#rdNum', 400, d.speed[0]], ['write', '#wrArc', '#wrNum', 400, d.speed[1]]]) {
    log(`Sequential ${k} test, 256 MB`, 'cur');
    for (let i = 0; i < 24; i++) { setRing(arc, num, v * rand(.7, 1.15) * Math.min(1, (i + 3) / 8), max); await sleep(90); }
    setRing(arc, num, v, max); log(`${k} result: ${v} MB/s`);
  }
  state.busy = false; e.target.disabled = false; toast('Speed test complete');
};
let scanning = false;
$('#scanBtn').onclick = async () => {
  if (state.busy) return;
  const d = state.drive; state.busy = scanning = true; state.abort = false;
  $('#scanBtn').disabled = true; $('#scanStop').disabled = false; d.status = 'scanning'; renderDrives(); openConsole();
  buildBlocks(); log(`Surface scan started on ${d.dev}`); log('Reading blocks sequentially', 'cur');
  const cells = $$('#blocks i'), bad = d.health < 80 ? 3 : 0;
  const badAt = new Set(Array.from({ length: bad }, () => Math.floor(rand(20, 220))));
  let found = 0;
  for (let i = 0; i < cells.length && !state.abort; i++) {
    cells[i].className = 'cur';
    if (i) cells[i - 1].className = badAt.has(i - 1) ? 'bad' : 'ok';
    if (badAt.has(i)) { found++; log(`Block ${i * 1024} unreadable, remapping`, 'w'); }
    $('#scanBar').style.width = ((i + 1) / cells.length * 100) + '%';
    $('#scanStat').textContent = `${i + 1} / ${cells.length} blocks · ${found} bad`;
    await sleep(22);
  }
  const last = $$('#blocks i.cur')[0]; if (last) last.className = 'ok';
  log(state.abort ? 'Scan stopped by user' : `Scan complete: ${found} bad blocks`, state.abort ? 'w' : '');
  d.status = 'healthy'; state.busy = scanning = false; $('#scanBtn').disabled = false; $('#scanStop').disabled = true;
  renderDrives(); toast(state.abort ? 'Scan stopped' : 'Scan complete');
};
$('#scanStop').onclick = () => { state.abort = true; };

/* ---------- format and clean ---------- */
const FS = ['FAT32', 'NTFS', 'exFAT', 'EXT4'];
function renderFs() {
  $('#fsChips').innerHTML = FS.map(f => `<button class="chip ${f === state.fs ? 'active' : ''}" data-f="${f}">${f}</button>`).join('');
  $$('#fsChips .chip').forEach(c => c.onclick = () => { state.fs = c.dataset.f; renderFs(); });
}
$$('#method button').forEach(b => b.onclick = () => {
  state.method = b.dataset.m; $$('#method button').forEach(x => x.classList.toggle('active', x === b));
  $('#methodHint').textContent = state.method === 'quick'
    ? 'Rebuilds the partition table and file system. Takes seconds.'
    : 'Overwrites every sector with zeros. Slower, data is unrecoverable.';
});
async function progress(label, steps, speed) {
  const fill = $('#opFill'), pct = $('#opPct'), liq = fill.parentElement;
  liq.classList.remove('idle'); $('#opStat').textContent = label;
  for (const [at, msg] of steps) {
    log(msg, 'cur');
    const from = parseFloat(fill.style.width) || 0;
    for (let p = from; p < at; p += 1) {
      fill.style.width = p + '%'; pct.textContent = Math.round(p) + '%'; await sleep(speed);
    }
  }
  fill.style.width = '100%'; pct.textContent = '100%'; liq.classList.add('idle'); $('#opStat').textContent = 'Finished';
  await sleep(1400); fill.style.width = '0%'; pct.textContent = '0%'; $('#opStat').textContent = 'No task running';
}
async function runOp(kind, status, label, steps, speed, after) {
  const d = state.drive; if (state.busy) return toast('Another task is running');
  state.busy = true; d.status = status; renderDrives(); openConsole();
  $$('#view-format button').forEach(b => b.disabled = true);
  $('#consoleDot').classList.add('busy');
  await progress(label, steps, speed);
  after(d); d.status = 'healthy'; state.busy = false; renderDrives(); renderChip(); renderFs();
  $$('#view-format button').forEach(b => b.disabled = false); $('#consoleDot').classList.remove('busy');
  toast(kind + ' complete');
}
$('#formatBtn').onclick = async () => {
  const d = state.drive, fs = state.fs, deep = state.method === 'deep';
  if (fs === 'FAT32' && d.gb > 32 && !await confirmModal({ title: 'FAT32 on a large drive', body: `FAT32 volumes over 32 GB use a non standard cluster size. Continue with ${d.gb} GB?` })) return;
  if (!await confirmModal({ title: `Format ${d.name}?`, body: `All data on ${d.dev} will be erased and the drive reformatted as ${fs}${deep ? ' with a zero fill' : ''}.`, word: 'FORMAT' })) return;
  const lbl = $('#label').value || 'USB';
  log(`mkfs.${fs.toLowerCase()} -L ${lbl} ${d.dev}1`, 'e');
  await runOp('Format', 'formatting', 'Formatting', [
    [15, 'Unmounting volumes'], [35, 'Writing new partition table (GPT)'], ...(deep ? [[70, 'Zero filling sectors']] : []),
    [90, `Creating ${fs} file system`], [100, `Label set to ${lbl}`],
  ], deep ? 45 : 14, x => { x.fs = fs; x.used = 0.01; });
};
$('#wipeBtn').onclick = async () => {
  const d = state.drive;
  if (!await confirmModal({ title: `Wipe ${d.name}?`, body: `Every sector on ${d.dev} will be overwritten with zeros. This cannot be undone.`, word: 'WIPE' })) return;
  log(`dd if=/dev/zero of=${d.dev} bs=4M`, 'e');
  await runOp('Wipe', 'wiping', 'Zero filling', [
    [20, 'Pass 1: zero fill'], [60, 'Writing zeros'], [90, 'Verifying sectors'], [100, 'Drive is blank'],
  ], 50, x => { x.used = 0; x.fs = 'RAW'; state.fs = 'exFAT'; });
};
$('#cleanBtn').onclick = async () => {
  const opts = [['cHidden', 'hidden system files'], ['cJunk', 'junk and temp files'], ['cAuto', 'autorun entries']].filter(([id]) => $('#' + id).checked);
  if (!opts.length) return toast('Pick at least one cleaner');
  if (!await confirmModal({ title: 'Clean drive?', body: 'Removes: ' + opts.map(o => o[1]).join(', ') + '.' })) return;
  const freed = rand(0.05, 0.4);
  await runOp('Clean', 'scanning', 'Cleaning', [
    ...opts.map(([, n], i) => [Math.round((i + 1) / opts.length * 90), `Removing ${n}`]), [100, `Freed ${(freed * 1024).toFixed(0)} MB`],
  ], 20, x => { x.used = Math.max(0, x.used - freed / x.gb); });
};

/* ---------- multiboot ---------- */
const fmt = mb => mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : Math.round(mb) + ' MB';
function addIso(name, mb) { state.isos.push({ name, mb }); log(`Queued ${name} (${fmt(mb)})`); renderIso(); }
function renderIso() {
  const d = state.drive; if (!d) return;
  const list = $('#isoList');
  list.innerHTML = state.isos.length ? '' : '<li class="empty" style="display:block;border:0;background:none">No images yet</li>';
  state.isos.forEach((x, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="sw" style="background:${SW[i % SW.length]}"></span><span class="n"></span><span class="s mono">${fmt(x.mb)}</span><button class="x">&times;</button>`;
    li.querySelector('.n').textContent = x.name;
    li.querySelector('.x').onclick = () => { state.isos.splice(i, 1); renderIso(); };
    list.append(li);
  });
  $('#isoTotal').textContent = state.isos.length + ' items';
  const total = d.gb * 1024, efi = 32, isoSum = state.isos.reduce((a, b) => a + b.mb, 0), free = total - efi - isoSum;
  const parts = [{ n: 'EFI', mb: efi, c: '#555', min: 3 }, ...state.isos.map((x, i) => ({ n: x.name, mb: x.mb, c: SW[i % SW.length] })), { n: 'Free', mb: Math.max(free, 0), c: '#161616' }];
  $('#layout').innerHTML = parts.map(p => `<div style="flex:${Math.max(p.mb, total * .004)};background:${p.c}" title="${p.n}"></div>`).join('');
  $('#legend').innerHTML = parts.map(p => `<span><b style="background:${p.c};outline:1px solid #444"></b>${p.n.length > 22 ? p.n.slice(0, 20) + '..' : p.n} ${fmt(p.mb)}</span>`).join('');
  $('#bootMenu').innerHTML = '<div class="hd">Multitool boot menu</div>' +
    (state.isos.length ? state.isos.map((x, i) => `<div class="${i ? '' : 'sel'}">${i + 1}. ${x.name.replace(/\.(iso|img)$/i, '')}</div>`).join('') : '<div>Empty</div>') +
    '<div class="hd" style="padding-top:8px">F1 Help   F2 Memtest   ESC Reboot</div>';
  if (free < 0) toast('Images exceed drive capacity');
}
const drop = $('#drop'), fileIn = $('#isoFile');
drop.onclick = e => { if (e.target.tagName !== 'BUTTON') fileIn.click(); };
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
const take = files => [...files].forEach(f => /\.(iso|img)$/i.test(f.name) ? addIso(f.name, f.size / 1048576) : toast('Skipped ' + f.name));
drop.addEventListener('drop', e => take(e.dataTransfer.files));
fileIn.onchange = () => { take(fileIn.files); fileIn.value = ''; };
$('#sample').onclick = () => {
  [['ubuntu_24.04_desktop.iso', 5900], ['win11_23h2_x64.iso', 6400], ['gparted_live.iso', 480], ['memtest86_plus.iso', 22]]
    .filter(s => !state.isos.some(x => x.name === s[0])).forEach(s => addIso(...s));
};
$('#installBtn').onclick = async () => {
  const d = state.drive; if (!state.isos.length) return toast('Add at least one image');
  if (!await confirmModal({ title: 'Install multiboot?', body: `${d.dev} will be repartitioned and ${state.isos.length} images copied. Existing data is erased.`, word: 'INSTALL' })) return;
  const steps = [[10, 'Writing bootloader to MBR'], [20, 'Creating EFI partition (32 MB)'],
    ...state.isos.map((x, i) => [20 + Math.round((i + 1) / state.isos.length * 70), `Copying ${x.name}`]), [100, 'Generating boot menu']];
  state.busy = true; openConsole(); $('#installBtn').disabled = true;
  for (const [, m] of steps) { log(m, 'cur'); await sleep(rand(500, 900)); }
  log('Multiboot drive ready', 'e'); state.busy = false; $('#installBtn').disabled = false; toast('Multiboot installed');
};

/* ---------- init ---------- */
renderDrives(); renderChip();
})();
