const assert = require('node:assert/strict');
const {
  evaluateForDisplay,
  evaluateExpression,
  format,
  pretty,
} = require('./app.js');

function closeTo(actual, expected, tolerance = 1e-10) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

assert.equal(evaluateExpression('༥+༣'), 8);
assert.equal(evaluateExpression('༢**༣'), 8);

closeTo(evaluateExpression('sin(pi/༢)', 'RAD'), 1);
closeTo(evaluateExpression('sin(༩༠)', 'DEG'), 1);
closeTo(evaluateExpression('cos(༡༨༠)', 'DEG'), -1);
closeTo(evaluateExpression('asin(༡)', 'DEG'), 90);
closeTo(evaluateExpression('acos(༠)', 'DEG'), 90);
closeTo(evaluateExpression('atan(༡)', 'DEG'), 45);

closeTo(evaluateExpression('༩%'), 0.09);
closeTo(evaluateExpression('༩%*༩'), 0.81);
closeTo(evaluateExpression('༢༠༠*༢༥%'), 50);

assert.equal(format(Math.E), '༢.༧༡༨༢༨༡༨༢༨༤༦');
assert.equal(
  evaluateForDisplay('༩༩༩༩༩༩༩༩༩༩༩༩*༩༩༩༩༩༩༩༩༩༩༩༩'),
  '༩༩༩༩༩༩༩༩༩༩༩༨༠༠༠༠༠༠༠༠༠༠༠༡',
);
assert.equal(pretty('༢**2'), '༢^༢');
assert.throws(() => evaluateExpression('asin(༡)cos(༡)'));
assert.throws(() => evaluateExpression('1/0'), RangeError);

class FakeClassList {
  constructor(values = []) { this.values = new Set(values); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) {
    if (force) this.values.add(value);
    else this.values.delete(value);
  }
}

function fakeElement({ dataset = {}, classes = [] } = {}) {
  return {
    dataset,
    classList: new FakeClassList(classes),
    textContent: '',
    scrollLeft: 0,
    scrollWidth: 0,
    listeners: {},
    addEventListener(type, listener) { this.listeners[type] = listener; },
    setAttribute() {},
    closest() { return this; },
  };
}

const expressionEl = fakeElement();
const previousEl = fakeElement();
const angleModeOptions = [
  fakeElement({ dataset: { angleMode: 'RAD' }, classes: ['angle-mode-option'] }),
  fakeElement({ dataset: { angleMode: 'DEG' }, classes: ['angle-mode-option'] }),
];
const statusMessageEl = fakeElement();
const memoryEl = fakeElement();
const shiftButton = fakeElement({ dataset: { action: 'shift' }, classes: ['action'] });
const keypad = fakeElement();
const trigButtons = [
  fakeElement({ dataset: { normal: 'sin(', shift: 'asin(' }, classes: ['function', 'trig'] }),
  fakeElement({ dataset: { normal: 'cos(', shift: 'acos(' }, classes: ['function', 'trig'] }),
  fakeElement({ dataset: { normal: 'tan(', shift: 'atan(' }, classes: ['function', 'trig'] }),
];

global.requestAnimationFrame = callback => callback();
global.document = {
  listeners: {},
  querySelector(selector) {
    return {
      '#expression': expressionEl,
      '#previous': previousEl,
      '#statusMessage': statusMessageEl,
      '#memoryIndicator': memoryEl,
      '[data-action="shift"]': shiftButton,
      '#keypad': keypad,
    }[selector];
  },
  querySelectorAll(selector) {
    if (selector === '.trig') return trigButtons;
    if (selector === '.angle-mode-option') return angleModeOptions;
    return [];
  },
  addEventListener(type, listener) { this.listeners[type] = listener; },
};

delete require.cache[require.resolve('./app.js')];
require('./app.js');

function click(button) {
  keypad.listeners.click({ target: button });
}

function action(name) {
  return fakeElement({ dataset: { action: name }, classes: ['action'] });
}

function value(input, classes = ['number']) {
  return fakeElement({ dataset: { value: input }, classes });
}

click(value('༢'));
click(action('memory-add'));
click(value('༣'));
click(action('memory-add'));
click(action('memory-recall'));
assert.equal(expressionEl.textContent, '༥');

click(action('clear'));
click(value('༡'));
click(action('memory-subtract'));
click(action('memory-recall'));
assert.equal(expressionEl.textContent, '༤');

click(action('clear'));
click(value('༩'));
click(value('%', ['function']));
click(value('༩'));
assert.equal(expressionEl.textContent, '༩% × ༩');
click(action('calculate'));
assert.equal(expressionEl.textContent, '༠.༨༡');

click(action('clear'));
assert.equal(angleModeOptions[0].classList.contains('selected'), true);
assert.equal(angleModeOptions[1].classList.contains('selected'), false);
angleModeOptions[1].listeners.click();
assert.equal(angleModeOptions[0].classList.contains('selected'), false);
assert.equal(angleModeOptions[1].classList.contains('selected'), true);
click(shiftButton);
click(trigButtons[0]);
click(value('༡'));
click(value(')', ['function']));
click(action('calculate'));
assert.equal(expressionEl.textContent, '༩༠');

click(action('clear'));
click(shiftButton);
click(trigButtons[0]);
click(value('༡'));
click(value(')', ['function']));
click(trigButtons[1]);
assert.equal(expressionEl.textContent, 'asin(༡)');
assert.equal(statusMessageEl.textContent, 'Use × between values');

delete global.document;
delete global.requestAnimationFrame;

console.log('Calculator core and interaction tests passed.');
