const tibetanDigits = '༠༡༢༣༤༥༦༧༨༩';
const arabicDigits = '0123456789';
const state = { expression: '', previous: '', status: 'RAD', memory: 0, shift: false, calculated: false };

const expressionEl = document.querySelector('#expression');
const previousEl = document.querySelector('#previous');
const statusEl = document.querySelector('#status');
const memoryEl = document.querySelector('#memoryIndicator');
const shiftButton = document.querySelector('[data-action="shift"]');

function toArabic(value) {
  return [...value].map(char => {
    const index = tibetanDigits.indexOf(char);
    return index < 0 ? char : arabicDigits[index];
  }).join('');
}

function toTibetan(value) {
  return [...value].map(char => {
    const index = arabicDigits.indexOf(char);
    return index < 0 ? char : tibetanDigits[index];
  }).join('');
}

function format(value) {
  if (Math.abs(value) < 1e-12) value = 0;
  const text = Number.isInteger(value) ? String(value) : Number(value.toPrecision(11)).toString();
  return toTibetan(text);
}

function pretty(value) {
  return value
    .replaceAll('*10**', ' × 10^')
    .replaceAll('**2', '²')
    .replaceAll('**', '^')
    .replaceAll('*', ' × ')
    .replaceAll('/', ' ÷ ')
    .replaceAll('+', ' + ')
    .replaceAll('-', ' − ')
    .replaceAll('pi', 'π');
}

function render() {
  expressionEl.textContent = state.expression ? pretty(state.expression) : '༠';
  previousEl.textContent = state.previous;
  statusEl.textContent = state.status;
  statusEl.classList.toggle('error', state.status !== 'RAD' && !state.status.startsWith('M'));
  memoryEl.classList.toggle('visible', state.memory !== 0);
  shiftButton.classList.toggle('shift-active', state.shift);
  shiftButton.textContent = state.shift ? '2nd' : 'SHIFT';
  document.querySelectorAll('.trig').forEach(button => {
    button.textContent = state.shift ? `${button.dataset.normal.replace('(', '')}⁻¹` : button.dataset.normal.replace('(', '');
  });
  requestAnimationFrame(() => { expressionEl.scrollLeft = expressionEl.scrollWidth; });
}

class Parser {
  constructor(source) { this.source = toArabic(source); this.index = 0; }
  parse() {
    const value = this.expression();
    this.spaces();
    if (this.index !== this.source.length || !Number.isFinite(value)) throw new Error('Invalid expression');
    return value;
  }
  expression() {
    let value = this.term();
    while (true) {
      if (this.take('+')) value += this.term();
      else if (this.take('-')) value -= this.term();
      else return value;
    }
  }
  term() {
    let value = this.power();
    while (true) {
      if (this.peek('*') && !this.peek('**')) { this.take('*'); value *= this.power(); }
      else if (this.take('/')) { const right = this.power(); if (right === 0) throw new RangeError('Division by zero'); value /= right; }
      else if (this.take('%')) { const right = this.power(); if (right === 0) throw new RangeError('Division by zero'); value %= right; }
      else return value;
    }
  }
  power() {
    let value = this.unary();
    if (this.take('**')) value **= this.power();
    return value;
  }
  unary() {
    if (this.take('+')) return this.unary();
    if (this.take('-')) return -this.unary();
    return this.primary();
  }
  primary() {
    if (this.take('(')) {
      const value = this.expression();
      if (!this.take(')')) throw new Error('Missing parenthesis');
      return value;
    }
    this.spaces();
    const number = this.source.slice(this.index).match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i)?.[0];
    if (number) { this.index += number.length; return Number(number); }
    const name = this.source.slice(this.index).match(/^[A-Za-z]+/)?.[0] || '';
    this.index += name.length;
    if (name === 'pi') return Math.PI;
    if (name === 'e') return Math.E;
    if (!name || !this.take('(')) throw new Error('Unknown value');
    const argument = this.expression();
    if (!this.take(')')) throw new Error('Missing parenthesis');
    const functions = {
      sin: Math.sin, cos: Math.cos, tan: Math.tan,
      asin: Math.asin, acos: Math.acos, atan: Math.atan,
      sqrt: Math.sqrt, log: Math.log10, ln: Math.log,
      exp: Math.exp, abs: Math.abs,
    };
    if (!functions[name]) throw new Error('Unknown function');
    return functions[name](argument);
  }
  spaces() { while (/\s/.test(this.source[this.index] || '')) this.index += 1; }
  peek(token) { this.spaces(); return this.source.startsWith(token, this.index); }
  take(token) { if (!this.peek(token)) return false; this.index += token.length; return true; }
}

function evaluate() {
  if (!state.expression || state.expression.length > 128) throw new Error('Invalid expression');
  return new Parser(state.expression).parse();
}

function append(value, operation = false) {
  if (state.calculated && !operation) state.expression = '';
  state.calculated = false;
  if (state.expression.length + value.length > 128) return;
  if (operation) {
    if (!state.expression && value !== '-') return;
    if (/(\*\*|[+\-*/%])$/.test(state.expression)) {
      state.expression = state.expression.replace(/(\*\*|[+\-*/%])$/, value);
      return render();
    }
  }
  state.expression += value;
  state.status = 'RAD';
  render();
}

function calculate() {
  if (!state.expression) return;
  try {
    const original = pretty(state.expression);
    state.expression = format(evaluate());
    state.previous = `${original}  =`;
    state.status = 'RAD';
    state.calculated = true;
  } catch (error) {
    state.status = error instanceof RangeError ? 'ཀླད་ཀོར་གྱིས་བགོ་མི་ཐུབ།' : 'ནོར་འཁྲུལ།';
  }
  render();
}

function updateMemory(multiplier) {
  try {
    state.memory += evaluate() * multiplier;
    state.status = multiplier > 0 ? 'M+ added' : 'M− subtracted';
  } catch { state.status = 'Memory error'; }
  render();
}

document.querySelector('#keypad').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'shift') state.shift = !state.shift;
  else if (action === 'clear') Object.assign(state, { expression: '', previous: '', status: 'RAD', calculated: false });
  else if (action === 'delete') { state.expression = state.expression.slice(0, -1); state.calculated = false; }
  else if (action === 'calculate') return calculate();
  else if (action === 'memory-clear') { state.memory = 0; state.status = 'Memory cleared'; }
  else if (action === 'memory-recall') return append(format(state.memory));
  else if (action === 'memory-add') return updateMemory(1);
  else if (action === 'memory-subtract') return updateMemory(-1);
  else {
    const value = button.classList.contains('trig')
      ? (state.shift ? button.dataset.shift : button.dataset.normal)
      : button.dataset.value;
    append(value, button.classList.contains('operator'));
    if (button.classList.contains('trig') && state.shift) state.shift = false;
  }
  render();
});

document.addEventListener('keydown', event => {
  if (/^[0-9.]$/.test(event.key)) append(toTibetan(event.key));
  else if (/^[+\-*/%()]$/.test(event.key)) append(event.key, /^[+\-*/%]$/.test(event.key));
  else if (event.key === 'Enter' || event.key === '=') calculate();
  else if (event.key === 'Backspace') { state.expression = state.expression.slice(0, -1); render(); }
  else if (event.key === 'Escape') { Object.assign(state, { expression: '', previous: '', status: 'RAD' }); render(); }
  else return;
  event.preventDefault();
});

render();
