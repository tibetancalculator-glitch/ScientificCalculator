const tibetanDigits = '༠༡༢༣༤༥༦༧༨༩';
const arabicDigits = '0123456789';

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
  const text = Number.isInteger(value)
    ? String(value)
    : Number(value.toPrecision(12)).toString();
  return toTibetan(text);
}

function pretty(value) {
  return value
    .replaceAll('*10**', ' × 10^')
    .replaceAll('**2', '^༢')
    .replaceAll('**', '^')
    .replaceAll('*', ' × ')
    .replaceAll('/', ' ÷ ')
    .replaceAll('+', ' + ')
    .replaceAll('-', ' − ')
    .replaceAll('pi', 'π');
}

class Parser {
  constructor(source, angleMode = 'RAD') {
    this.source = toArabic(source);
    this.angleMode = angleMode;
    this.index = 0;
  }

  parse() {
    const value = this.expression();
    this.spaces();
    if (this.index !== this.source.length || !Number.isFinite(value)) {
      throw new Error('Invalid expression');
    }
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
      if (this.peek('*') && !this.peek('**')) {
        this.take('*');
        value *= this.power();
      } else if (this.take('/')) {
        const right = this.power();
        if (right === 0) throw new RangeError('Division by zero');
        value /= right;
      } else {
        return value;
      }
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
    return this.postfix();
  }

  postfix() {
    let value = this.primary();
    while (this.take('%')) value /= 100;
    return value;
  }

  primary() {
    if (this.take('(')) {
      const value = this.expression();
      if (!this.take(')')) throw new Error('Missing parenthesis');
      return value;
    }

    this.spaces();
    const number = this.source
      .slice(this.index)
      .match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i)?.[0];
    if (number) {
      this.index += number.length;
      return Number(number);
    }

    const name = this.source.slice(this.index).match(/^[A-Za-z]+/)?.[0] || '';
    this.index += name.length;
    if (name === 'pi') return Math.PI;
    if (name === 'e') return Math.E;
    if (!name || !this.take('(')) throw new Error('Unknown value');

    const argument = this.expression();
    if (!this.take(')')) throw new Error('Missing parenthesis');
    const toRadians = value => this.angleMode === 'DEG'
      ? value * Math.PI / 180
      : value;
    const fromRadians = value => this.angleMode === 'DEG'
      ? value * 180 / Math.PI
      : value;

    const functions = {
      sin: value => Math.sin(toRadians(value)),
      cos: value => Math.cos(toRadians(value)),
      tan: value => Math.tan(toRadians(value)),
      asin: value => fromRadians(Math.asin(value)),
      acos: value => fromRadians(Math.acos(value)),
      atan: value => fromRadians(Math.atan(value)),
      sqrt: Math.sqrt,
      log: Math.log10,
      ln: Math.log,
      exp: Math.exp,
      abs: Math.abs,
    };
    if (!functions[name]) throw new Error('Unknown function');
    return functions[name](argument);
  }

  spaces() {
    while (/\s/.test(this.source[this.index] || '')) this.index += 1;
  }

  peek(token) {
    this.spaces();
    return this.source.startsWith(token, this.index);
  }

  take(token) {
    if (!this.peek(token)) return false;
    this.index += token.length;
    return true;
  }
}

function evaluateExpression(expression, angleMode = 'RAD') {
  if (!expression || expression.length > 128) {
    throw new Error('Invalid expression');
  }
  return new Parser(expression, angleMode).parse();
}

function evaluateForDisplay(expression, angleMode = 'RAD') {
  if (!expression || expression.length > 128) {
    throw new Error('Invalid expression');
  }

  const normalized = toArabic(expression).replaceAll(/\s+/g, '');
  if (/^[+-]?\d+(?:\*[+-]?\d+)+$/.test(normalized)) {
    const product = normalized
      .split('*')
      .map(value => BigInt(value))
      .reduce((result, value) => result * value, 1n);
    return toTibetan(product.toString());
  }

  return format(evaluateExpression(expression, angleMode));
}

if (typeof module !== 'undefined') {
  module.exports = {
    Parser,
    evaluateForDisplay,
    evaluateExpression,
    format,
    pretty,
    toArabic,
    toTibetan,
  };
}

if (typeof document !== 'undefined') {
  const state = {
    expression: '',
    previous: '',
    angleMode: 'RAD',
    message: '',
    messageIsError: false,
    memory: 0,
    shift: false,
    calculated: false,
  };

  const expressionEl = document.querySelector('#expression');
  const previousEl = document.querySelector('#previous');
  const angleModeOptions = document.querySelectorAll('.angle-mode-option');
  const statusMessageEl = document.querySelector('#statusMessage');
  const memoryEl = document.querySelector('#memoryIndicator');
  const shiftButton = document.querySelector('[data-action="shift"]');

  function setMessage(message = '', isError = false) {
    state.message = message;
    state.messageIsError = isError;
  }

  function render() {
    expressionEl.textContent = state.expression ? pretty(state.expression) : '༠';
    previousEl.textContent = state.previous;
    angleModeOptions.forEach(button => {
      const selected = button.dataset.angleMode === state.angleMode;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    statusMessageEl.textContent = state.message;
    statusMessageEl.classList.toggle('error', state.messageIsError);
    memoryEl.classList.toggle('visible', state.memory !== 0);
    shiftButton.classList.toggle('shift-active', state.shift);
    shiftButton.textContent = state.shift ? '2nd' : 'SHIFT';
    document.querySelectorAll('.trig').forEach(button => {
      const normal = button.dataset.normal.replace('(', '');
      button.textContent = state.shift ? `${normal}⁻¹` : normal;
    });
    requestAnimationFrame(() => {
      expressionEl.scrollLeft = expressionEl.scrollWidth;
    });
  }

  function evaluate() {
    return evaluateExpression(state.expression, state.angleMode);
  }

  function append(value, operation = false) {
    const isPostfix = value === '%' || value === '**2';
    if (state.calculated && !operation && !isPostfix) state.expression = '';
    state.calculated = false;
    if (state.expression.length + value.length > 128) return;

    const endsWithNumber = /[0-9༠-༩]$/.test(state.expression);
    const endsWithConstant = state.expression.endsWith('pi') ||
      (state.expression.endsWith('e') && !state.expression.endsWith('**e'));
    const endsWithClosedValue = state.expression.endsWith(')') ||
      state.expression.endsWith('%') || endsWithConstant;
    const startsWithNumber = /^[0-9༠-༩.]/.test(value);
    const startsNewValue = value === 'pi' || value === 'e' || value === '(' ||
      /^[A-Za-z]+\($/.test(value);

    if (startsWithNumber && state.expression.endsWith('%')) {
      if (state.expression.length + value.length + 1 > 128) return;
      state.expression += `*${value}`;
      setMessage();
      return render();
    }

    if ((startsNewValue && (endsWithNumber || endsWithClosedValue)) ||
        (startsWithNumber && endsWithClosedValue)) {
      setMessage('Use × between values', true);
      return render();
    }

    if (value === ')') {
      const openCount = (state.expression.match(/\(/g) || []).length;
      const closeCount = (state.expression.match(/\)/g) || []).length;
      if (openCount <= closeCount || (!endsWithNumber && !endsWithClosedValue)) {
        setMessage('Complete the value before )', true);
        return render();
      }
    }

    if (value === '%') {
      if (!endsWithNumber && !state.expression.endsWith(')')) {
        setMessage('Enter a value before %', true);
        return render();
      }
      state.expression += value;
      setMessage();
      return render();
    }

    if (value === '**2' && !endsWithNumber && !endsWithClosedValue) {
      setMessage('Enter a value before x^༢', true);
      return render();
    }

    if (operation) {
      if (!state.expression && value !== '-') return;
      if (/(\*\*|[+\-*/])$/.test(state.expression)) {
        state.expression = state.expression.replace(/(\*\*|[+\-*/])$/, value);
        setMessage();
        return render();
      }
    }

    state.expression += value;
    setMessage();
    render();
  }

  function calculate() {
    if (!state.expression) return;
    try {
      const original = pretty(state.expression);
      state.expression = evaluateForDisplay(state.expression, state.angleMode);
      state.previous = `${original}  =`;
      state.calculated = true;
      setMessage();
    } catch (error) {
      setMessage(
        error instanceof RangeError
          ? 'ཀླད་ཀོར་གྱིས་བགོ་མི་ཐུབ།'
          : 'ནོར་འཁྲུལ།',
        true,
      );
    }
    render();
  }

  function updateMemory(multiplier) {
    try {
      const value = state.expression ? evaluate() : 0;
      state.memory += value * multiplier;
      if (Math.abs(state.memory) < 1e-12) state.memory = 0;
      state.calculated = Boolean(state.expression);
      setMessage(multiplier > 0 ? 'M+ added' : 'M− subtracted');
    } catch {
      setMessage('Memory error', true);
    }
    render();
  }

  function recallMemory() {
    const recalled = format(state.memory);
    const canInsertAsOperand = state.expression.endsWith('(') ||
      /(\*\*|[+\-*/])$/.test(state.expression);

    if (canInsertAsOperand && !state.calculated) {
      const operand = recalled.startsWith('-') ? `(${recalled})` : recalled;
      if (state.expression.length + operand.length <= 128) {
        state.expression += operand;
      }
      state.calculated = false;
    } else {
      state.expression = recalled;
      state.previous = '';
      state.calculated = true;
    }
    setMessage('Memory recalled');
    render();
  }

  angleModeOptions.forEach(button => {
    button.addEventListener('click', () => {
      const selectedMode = button.dataset.angleMode;
      if (selectedMode === state.angleMode) return;
      state.angleMode = selectedMode;
      setMessage();
      render();
    });
  });

  document.querySelector('#keypad').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const action = button.dataset.action;

    if (action === 'shift') state.shift = !state.shift;
    else if (action === 'clear') {
      Object.assign(state, { expression: '', previous: '', calculated: false });
      setMessage();
    } else if (action === 'delete') {
      state.expression = state.expression.slice(0, -1);
      state.calculated = false;
      setMessage();
    } else if (action === 'calculate') return calculate();
    else if (action === 'memory-clear') {
      state.memory = 0;
      setMessage('Memory cleared');
    } else if (action === 'memory-recall') return recallMemory();
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
    else if (event.key === '%') append('%');
    else if (/^[+\-*/()]$/.test(event.key)) {
      append(event.key, /^[+\-*/]$/.test(event.key));
    } else if (event.key === 'Enter' || event.key === '=') calculate();
    else if (event.key === 'Backspace') {
      state.expression = state.expression.slice(0, -1);
      state.calculated = false;
      setMessage();
      render();
    } else if (event.key === 'Escape') {
      Object.assign(state, { expression: '', previous: '', calculated: false });
      setMessage();
      render();
    } else {
      return;
    }
    event.preventDefault();
  });

  render();
}
