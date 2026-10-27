(() => {
  'use strict';

  // ------------------------------------------------------------
  // Stack (LIFO): every key press that adds to the expression is
  // pushed here, so Delete simply pops the most recent entry --
  // a digit, a decimal point or an operator.
  // ------------------------------------------------------------
  class Stack {
    constructor() { this.items = []; }
    push(x)   { this.items.push(x); }
    pop()     { return this.items.pop(); }
    peek()    { return this.items[this.items.length - 1]; }
    isEmpty() { return this.items.length === 0; }
    clear()   { this.items = []; }
    toArray() { return this.items.slice(); }
    load(arr) { this.items = arr.slice(); }
  }

  const OPS = '+-*/';
  const SYMBOL = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  const PREC = { '+': 1, '-': 1, '*': 2, '/': 2 };
  const MAX_DIGITS = 15;

  const isOp = c => OPS.includes(c);
  const isNumChar = c => (c >= '0' && c <= '9') || c === '.';

  const input = new Stack();
  let justEvaluated = false;   // true right after "="
  let lastExpr = '';           // expression shown above the result
  let errorMsg = '';

  const exprEl = document.getElementById('expr');
  const previewEl = document.getElementById('preview');

  // ---------- Evaluation (two stacks: values + operators) ----------
  function tokenize(chars) {
    const tokens = [];
    let i = 0;
    while (i < chars.length) {
      const c = chars[i];
      const prevIsValue = tokens.length > 0 && typeof tokens[tokens.length - 1] === 'number';
      if (isNumChar(c) || (c === '-' && !prevIsValue)) {   // '-' not after a number = negative sign
        let s = '';
        if (c === '-') { s = '-'; i++; }
        while (i < chars.length && isNumChar(chars[i])) s += chars[i++];
        const n = Number(s);
        if (s === '-' || Number.isNaN(n)) throw new Error('invalid');
        tokens.push(n);
      } else {
        tokens.push(c);
        i++;
      }
    }
    return tokens;
  }

  function stripTrailingOps(chars) {
    const c = chars.slice();
    while (c.length && isOp(c[c.length - 1])) c.pop();
    return c;
  }

  function hasBinaryOp(chars) {
    return /[0-9.][+\-*/]/.test(chars.join(''));
  }

  function evaluate(chars) {
    const c = stripTrailingOps(chars);
    if (!c.length) return null;
    const values = new Stack();
    const ops = new Stack();
    const apply = () => {
      const op = ops.pop();
      const b = values.pop();
      const a = values.pop();
      if (op === '/' && b === 0) throw new Error('div0');
      values.push(op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : a / b);
    };
    for (const t of tokenize(c)) {
      if (typeof t === 'number') {
        values.push(t);
      } else {
        while (!ops.isEmpty() && PREC[ops.peek()] >= PREC[t]) apply();
        ops.push(t);
      }
    }
    while (!ops.isEmpty()) apply();
    return values.pop();
  }

  // Plain decimal string (no exponent) so the result can go back on the stack
  function toPlain(n) {
    const r = parseFloat(n.toPrecision(12));
    if (!isFinite(r) || Math.abs(r) >= 1e15) throw new Error('big');
    let s = r.toFixed(10).replace(/\.?0+$/, '');
    if (s === '-0' || s === '') s = '0';
    return s;
  }

  function group(str) {
    const neg = str.startsWith('-');
    const [int, dec] = str.replace('-', '').split('.');
    const g = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + g + (dec !== undefined ? '.' + dec : '');
  }

  // ---------- Display ----------
  function formatExpr(chars) {
    if (!chars.length) return '0';
    return chars.map((c, i) => {
      if (!isOp(c)) return c;
      const binary = i > 0 && !isOp(chars[i - 1]);
      return binary ? ' ' + SYMBOL[c] + ' ' : SYMBOL[c];
    }).join('');
  }

  function previewText(chars) {
    if (justEvaluated) return lastExpr;
    const c = stripTrailingOps(chars);
    if (!hasBinaryOp(c)) return '';
    try {
      const v = evaluate(c);
      return v === null ? '' : '= ' + group(toPlain(v));
    } catch (e) {
      return '';
    }
  }

  function render() {
    const chars = input.toArray();
    const text = errorMsg || formatExpr(chars);
    exprEl.textContent = text;
    exprEl.className = 'expr' + (errorMsg ? ' err' : text.length > 18 ? ' sm' : text.length > 10 ? ' md' : '');
    previewEl.textContent = errorMsg ? '' : previewText(chars);
    exprEl.scrollLeft = exprEl.scrollWidth;
  }

  // ---------- Helpers ----------
  function lastNumber(chars) {
    let i = chars.length;
    while (i > 0 && isNumChar(chars[i - 1])) i--;
    return { start: i, text: chars.slice(i).join('') };
  }

  // A new digit or dot after "=" starts a fresh calculation
  function prepareForNumber() {
    if (errorMsg) clearAll();
    if (justEvaluated) { input.clear(); justEvaluated = false; }
  }

  // ---------- Actions ----------
  function pressDigit(d) {
    prepareForNumber();
    const { text } = lastNumber(input.toArray());
    if (text === '0') input.pop();                                   // 0 then 5 -> 5
    else if (text.replace('.', '').length >= MAX_DIGITS) return;
    input.push(d);
  }

  function pressDot() {
    prepareForNumber();
    const { text } = lastNumber(input.toArray());
    if (text.includes('.')) return;
    if (text === '') input.push('0');
    input.push('.');
  }

  function pressOperator(op) {
    if (errorMsg) clearAll();
    justEvaluated = false;               // keep going from the result
    if (input.isEmpty()) {
      if (op === '-') input.push('-');   // leading negative sign
      return;
    }
    const last = input.peek();
    if (isOp(last)) {
      if (op === '-' && last !== '-') { input.push('-'); return; }   // e.g. 5 × -3
      input.pop();                                                   // replace the operator
      if (!input.isEmpty() && isOp(input.peek())) input.pop();       // ...and a negative sign before it
      if (input.isEmpty()) { if (op === '-') input.push('-'); return; }
    }
    input.push(op);
  }

  function pressDelete() {
    if (errorMsg) { clearAll(); return; }
    justEvaluated = false;               // editing the result digit by digit
    input.pop();                         // LIFO: remove the most recent entry
  }

  function clearAll() {
    input.clear();
    justEvaluated = false;
    errorMsg = '';
    lastExpr = '';
  }

  function pressEquals() {
    if (errorMsg || justEvaluated) return;
    const chars = input.toArray();
    const c = stripTrailingOps(chars);
    if (!hasBinaryOp(c)) return;
    try {
      const result = toPlain(evaluate(c));
      lastExpr = formatExpr(c) + ' =';
      input.load(result.split(''));     // result goes back on the stack, so it can be deleted digit by digit
      justEvaluated = true;
    } catch (e) {
      errorMsg = e.message === 'div0' ? 'Cannot divide by 0'
               : e.message === 'big'  ? 'Result too large'
               : 'Invalid expression';
    }
  }

  function pressPercent() {
    if (errorMsg) clearAll();
    const chars = input.toArray();
    const { start, text } = lastNumber(chars);
    if (text === '' || text === '.') return;
    const replaced = chars.slice(0, start).concat(toPlain(Number(text) / 100).split(''));
    input.load(replaced);
    justEvaluated = false;
  }

  function pressSign() {
    if (errorMsg) clearAll();
    const chars = input.toArray();
    const { start, text } = lastNumber(chars);
    if (text === '') return;
    const unary = chars[start - 1] === '-' && (start - 1 === 0 || isOp(chars[start - 2]));
    if (unary) chars.splice(start - 1, 1);
    else chars.splice(start, 0, '-');
    input.load(chars);
    justEvaluated = false;
  }

  // ---------- Events ----------
  const keys = document.getElementById('keys');
  const backBtn = document.getElementById('back');
  let holdTimer = null, repeatTimer = null, suppressClick = false;

  keys.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.action === 'back' && suppressClick) { suppressClick = false; return; }
    if (btn.dataset.digit) pressDigit(btn.dataset.digit);
    else if (btn.dataset.op) pressOperator(btn.dataset.op);
    else switch (btn.dataset.action) {
      case 'dot':     pressDot(); break;
      case 'equals':  pressEquals(); break;
      case 'clear':   clearAll(); break;
      case 'back':    pressDelete(); break;
      case 'sign':    pressSign(); break;
      case 'percent': pressPercent(); break;
    }
    render();
  });

  // Hold the delete key to pop entries continuously
  function stopHold() {
    clearTimeout(holdTimer);
    clearInterval(repeatTimer);
  }
  backBtn.addEventListener('pointerdown', () => {
    suppressClick = false;
    holdTimer = setTimeout(() => {
      suppressClick = true;
      repeatTimer = setInterval(() => { pressDelete(); render(); }, 90);
    }, 450);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => backBtn.addEventListener(ev, stopHold));

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (/^[0-9]$/.test(k)) pressDigit(k);
    else if (k === '.' || k === ',') pressDot();
    else if (OPS.includes(k) && k.length === 1) { pressOperator(k); if (k === '/') e.preventDefault(); }
    else if (k === 'Enter' || k === '=') { e.preventDefault(); pressEquals(); }
    else if (k === 'Backspace') pressDelete();   // holding the key repeats natively
    else if (k === 'Escape' || k === 'c' || k === 'C') clearAll();
    else if (k === '%') pressPercent();
    else return;
    render();
  });

  render();
})();
