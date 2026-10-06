// Local verification driver: private rubrics stay in Node, never in the public document.
export const authoredBoardTypes = ['money.running-ledger.v2', 'money.unit-price.v2', 'visual.percent-grid.v2', 'visual.chart.v2', 'math.worked-example.v2'];

async function key(page, key, code, windowsVirtualKeyCode, modifiers = 0) {
  for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', {type,key,code,windowsVirtualKeyCode,modifiers});
}

async function typeNumber(page, index, value, press, wait) {
  const selector = '.lf-number-answer input';
  const formatted = await page.evaluate(`(() => {const locale=document.querySelector('.lf-rebuild').getAttribute('lang');return {typed:new Intl.NumberFormat(locale,{useGrouping:false,maximumFractionDigits:12}).format(${Number(value)}),echo:new Intl.NumberFormat(locale,{maximumFractionDigits:12}).format(${Number(value)})};})()`);
  await page.evaluate(`document.querySelectorAll(${JSON.stringify(selector)})[${index}].setAttribute('data-audit-number','active')`);
  await press(page, '[data-audit-number="active"]');
  await key(page, 'a', 'KeyA', 65, 2);
  await page.send('Input.insertText', {text:formatted.typed});
  // A native input value can change before React's parsed answer is displayed.
  // Wait for the learner-visible interpretation, then let its effect reach the board.
  await wait(page, `document.querySelector('[data-audit-number="active"]').value===${JSON.stringify(formatted.typed)} && document.querySelector('[data-audit-number="active"]').closest('.lf-number-answer').querySelector('.lf-number-echo').textContent.includes(${JSON.stringify(formatted.echo)})`, 'parsed number echo');
  await page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  await page.evaluate(`document.querySelector('[data-audit-number="active"]').removeAttribute('data-audit-number')`);
}

function ledgerMoves(payload, target) {
  for (let depth = 1; depth <= payload.maxEntries; depth++) {
    for (let costs = depth; costs >= 0; costs--) {
      const sales = depth - costs;
      if (payload.initial - costs * payload.cost + sales * payload.sale === target) return [...Array(costs).fill(2), ...Array(sales).fill(1)];
    }
  }
  throw Error('No permitted ledger sequence reaches the private target');
}

export async function exerciseAuthoredBoard(page, fixture, source, press, wait) {
  const segment = fixture.segment, rubric = source.answer_keys[segment.id];
  if (!rubric || !authoredBoardTypes.includes(segment.type)) throw Error('Unsupported authored board');
  const submissions = [];
  const observe = event => {
    const message = JSON.parse(event.data);
    if (message.sessionId === page.sessionId && message.method === 'Network.requestWillBeSent' && message.params.request.method === 'POST' && message.params.request.url.includes('/__course_review?')) submissions.push(message.params.request.postData);
  };
  page.ws.addEventListener('message', observe);
  try {
  const action = segment.type === 'math.worked-example.v2' ? '.lf-worked-example-complete button' : '.lf-learning-actions button';
  const submit = async (verdict) => {
    await wait(page, `!!document.querySelector(${JSON.stringify(action + ':not([disabled])')})`, 'answer ready');
    await press(page, action);
    try {
      await wait(page, `!!document.querySelector('.lf-learning-feedback--${verdict}')`, verdict+' feedback');
    } catch (error) {
      const state = await page.evaluate(`({inputs:[...document.querySelectorAll('.lf-number-answer input')].map(input=>input.value),echoes:[...document.querySelectorAll('.lf-number-echo')].map(node=>node.textContent),feedback:document.querySelector('.lf-learning-feedback')?.textContent,action:document.querySelector('.lf-learning-actions')?.textContent})`);
      throw Error(error.message+' '+JSON.stringify({...state,submissions}));
    }
    const text = await page.evaluate(`document.querySelector('.lf-learning-feedback--${verdict}').textContent`);
    if (!text.includes(verdict === 'met' ? segment.feedback.met : segment.feedback.not_yet)) throw Error('Authored board feedback mismatch');
  };
  if (segment.type === 'math.worked-example.v2') {
    const enterSteps = async wrong => {
      for (let index = 1; index < segment.payload.steps.length; index++) {
        const step = segment.payload.steps[index];
        const value = Number(rubric.expectedValues[step.id]) + (wrong && index === 1 ? 1 : 0);
        if (!Number.isFinite(value)) throw Error('Worked-example driver requires finite authored numeric answers');
        const typed = new Intl.NumberFormat(source.document.locale, {useGrouping:false,maximumFractionDigits:12}).format(value);
        const selector = index >= segment.payload.steps.length - segment.payload.fade_count
          ? `.lf-worked-example-blank input` : '.lf-worked-example-prediction input';
        // Only the next faded input is new; earlier faded answers remain visible.
        const inputIndex = index >= segment.payload.steps.length - segment.payload.fade_count
          ? index - (segment.payload.steps.length - segment.payload.fade_count) : 0;
        await page.evaluate(`document.querySelectorAll(${JSON.stringify(selector)})[${inputIndex}].setAttribute('data-audit-worked','active')`);
        await press(page, '[data-audit-worked="active"]');
        await key(page, 'a', 'KeyA', 65, 2);
        await page.send('Input.insertText', {text:typed});
        await wait(page, `document.querySelector('[data-audit-worked="active"]').value===${JSON.stringify(typed)} && !!document.querySelector('.lf-worked-example-prediction button:not([disabled])')`, 'worked prediction ready');
        await page.evaluate(`document.querySelector('[data-audit-worked="active"]').removeAttribute('data-audit-worked')`);
        await press(page, '.lf-worked-example-prediction button');
      }
    };
    await enterSteps(true);
    await submit('review');
    await wait(page, '!!document.querySelector(".lf-learning-control-bar button:not([disabled])")', 'worked reset ready');
    await press(page, '.lf-learning-control-bar button');
    await wait(page, '!!document.querySelector(".lf-worked-example-prediction") && !document.querySelector(".lf-worked-example-complete")', 'worked reset');
    await enterSteps(false);
  } else if (segment.type === 'money.running-ledger.v2') {
    for (const move of ledgerMoves(segment.payload, rubric.target_balance)) await press(page, `.lf-ledger-controls button:nth-child(${move})`);
    await typeNumber(page, 0, rubric.target_balance + 1, press, wait);
    await submit('review');
    await typeNumber(page, 0, rubric.target_balance, press, wait);
  } else if (segment.type === 'visual.percent-grid.v2') {
    await press(page, 'input[type="range"]');
    await key(page, 'Home', 'Home', 36);
    if (rubric.target_percent % segment.payload.step) throw Error('Target not reachable through slider steps');
    for (let value = 0; value < rubric.target_percent; value += segment.payload.step) await key(page, 'ArrowRight', 'ArrowRight', 39);
    await wait(page, `Number(document.querySelector('input[type="range"]').value)===${rubric.target_percent}`, 'slider target');
    const amount = segment.payload.baseUnits * rubric.target_percent / 100;
    await typeNumber(page, 0, amount + 1, press, wait);
    await submit('review');
    await typeNumber(page, 0, amount, press, wait);
  } else if (segment.type === 'money.unit-price.v2') {
    for (const [index, offer] of segment.payload.offers.entries()) await typeNumber(page, index, rubric.unit_prices[offer.id], press, wait);
    const wrong = segment.payload.offers.find(offer => offer.id !== rubric.better_id);
    await press(page, `label:has(input[value="${wrong.id}"])`);
    await submit('review');
    await press(page, `label:has(input[value="${rubric.better_id}"])`);
  } else {
    const options = segment.payload.question.options;
    const correct = options.findIndex(option => rubric.acceptable_choice_ids.includes(option.id));
    const wrong = options.findIndex((_, index) => index !== correct);
    await press(page, `.lf-story-options button:nth-child(${wrong + 1})`);
    await submit('review');
    await press(page, `.lf-story-options button:nth-child(${correct + 1})`);
  }
  await submit('met');
  await wait(page, `!!document.querySelector(${JSON.stringify(action + ':not([disabled])')})`, 'advance ready');
  await press(page, action);
  const next = source.document.segments[fixture.step + 1];
  await wait(page, next ? `document.querySelector('main.lf-learning [data-copy-role="prompt"]')?.textContent===${JSON.stringify(next.prompt)}` : '!!document.querySelector("main[data-screen=lesson-preview-end]") || !document.querySelector("main.lf-learning")', 'advance after board');
  return {incorrectRejected:true,authoredFeedbackMatched:true,correctionAccepted:true,advanced:true};
  } finally { page.ws.removeEventListener('message', observe); }
}
