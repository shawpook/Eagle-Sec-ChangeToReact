# bw-probe1 ② 以后区段重写为 __bwCap 捕获模式（一次性手术脚本）
import io

p = 'tests-tmp/bw-probe1.mjs'
s = io.open(p, encoding='utf-8').read()
start = s.index('  // ② confirm resolve(true)')
end = s.index('  if (failure) throw failure;')

new_section = '''  // ② confirm resolve(true) + DOM 类结构（套件断言同款选择器）
  await evaluate(`(() => new Promise((outer) => {
    window.__bwCap = {};
    window.swal({ html: '<div class="alert"><h4 class="alert-title">bw-probe</h4></div>', title: 'T', showCancelButton: true, confirmButtonText: 'GO', cancelButtonText: 'NO', customClass: 'alert-box probe-custom', width: 400, padding: 24 })
      .then((v) => { window.__bwCap.resolve = v; outer('s'); }, (r) => { window.__bwCap.reject = r; outer('s'); });
    setTimeout(() => {
      window.__bwCap.dom = {
        container: !!document.querySelector('.swal2-container'),
        modal: !!document.querySelector('.swal2-container .swal2-modal'),
        confirm: !!document.querySelector('.swal2-container .swal2-confirm'),
        cancel: !!document.querySelector('.swal2-container .swal2-cancel'),
        custom: !!document.querySelector('.swal2-modal.alert-box.probe-custom'),
        title: document.querySelector('.swal2-title')?.textContent,
        confirmText: document.querySelector('.swal2-confirm')?.textContent,
        cancelText: document.querySelector('.swal2-cancel')?.textContent,
      };
      document.querySelector('.swal2-confirm').click();
    }, 60);
  }))()`);
  const cap2 = await evaluate(`window.__bwCap`);
  assert('confirm-resolves-true', cap2.resolve === true && cap2.reject === undefined, cap2);
  const dom2 = cap2.dom || {};
  assert('dom-swal2-structure', dom2.container && dom2.modal && dom2.confirm && dom2.cancel && dom2.custom && dom2.title === 'T' && dom2.confirmText === 'GO' && dom2.cancelText === 'NO', dom2);

  // ③ then(ok, cancel) 双参消费：cancel reject('cancel')
  const cancelResult = await evaluate(`(() => new Promise((outer) => {
    window.swal({ html: 'x', showCancelButton: true, confirmButtonText: 'GO', cancelButtonText: 'NO' })
      .then((v) => outer({ resolve: v }), (r) => outer({ reject: r }));
    setTimeout(() => document.querySelector('.swal2-cancel').click(), 60);
  }))()`);
  assert('cancel-rejects-reason', cancelResult.reject === 'cancel', cancelResult);

  // ④ esc reject('esc')——document keydown 消费面
  const escResult = await evaluate(`(() => new Promise((outer) => {
    window.swal({ html: 'x', showCancelButton: true })
      .then((v) => outer({ resolve: v }), (r) => outer({ reject: r }));
    setTimeout(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }, 60);
  }))()`);
  assert('esc-rejects', escResult.reject === 'esc', escResult);

  // ⑤ overlay click reject('overlay')（allowOutsideClick 默认 true）
  const overlayResult = await evaluate(`(() => new Promise((outer) => {
    window.swal({ html: 'x', showCancelButton: true })
      .then((v) => outer({ resolve: v }), (r) => outer({ reject: r }));
    setTimeout(() => document.querySelector('.swal2-container').dispatchEvent(new MouseEvent('click', { bubbles: true })), 60);
  }))()`);
  assert('overlay-rejects', overlayResult.reject === 'overlay', overlayResult);

  // ⑥ allowOutsideClick false → 不 dismiss
  const noOverlayResult = await evaluate(`(() => new Promise((outer) => {
    window.swal({ html: 'x', allowOutsideClick: false, showCancelButton: true })
      .then((v) => outer('RESOLVED'), (r) => outer('REJECTED:' + r));
    setTimeout(() => {
      document.querySelector('.swal2-container').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      setTimeout(() => {
        outer(document.querySelector('.swal2-modal') ? 'STILL-OPEN' : 'CLOSED');
      }, 80);
    }, 60);
  }))()`);
  assert('allowOutsideClick-false-keeps-open', noOverlayResult === 'STILL-OPEN', noOverlayResult);
  await evaluate(`(() => { window.swal.close(); return true; })()`);

  // ⑦ × 关闭 reject('close')（showCloseButton）
  const closeResult = await evaluate(`(() => new Promise((outer) => {
    window.swal({ html: 'x', showCloseButton: true, showCancelButton: false })
      .then((v) => outer({ resolve: v }), (r) => outer({ reject: r }));
    setTimeout(() => document.querySelector('.swal2-close').click(), 60);
  }))()`);
  assert('close-x-rejects', closeResult.reject === 'close', closeResult);

  // ⑧ input text：inputValue 预填 + statics getInput/getConfirmButton + 编辑后 resolve 值
  await evaluate(`(() => new Promise((outer) => {
    window.__bwCap = {};
    window.swal({ html: 'x', input: 'text', inputValue: 'seed', inputPlaceholder: 'ph', showCancelButton: true })
      .then((v) => { window.__bwCap.resolve = v; outer('s'); }, (r) => { window.__bwCap.reject = r; outer('s'); });
    setTimeout(() => {
      const input = document.querySelector('.swal2-input');
      window.__bwCap.st = {
        staticInput: window.swal.getInput() === input,
        staticConfirm: !!window.swal.getConfirmButton() && window.swal.getConfirmButton().classList.contains('swal2-confirm'),
        prefill: input.value,
        placeholder: input.placeholder,
      };
      input.value = '  edited  ';
      document.querySelector('.swal2-confirm').click();
    }, 60);
  }))()`);
  const cap8 = await evaluate(`window.__bwCap`);
  assert('input-text-contract', cap8.resolve === 'edited' && cap8.st && cap8.st.staticInput === true && cap8.st.staticConfirm === true && cap8.st.prefill === 'seed' && cap8.st.placeholder === 'ph', cap8);

  // ⑨ inputValidator 失败 → validationerror 显出 + inputerror 类；修正后通过
  await evaluate(`(() => new Promise((outer) => {
    window.__bwCap = {};
    window.swal({ html: 'x', input: 'text', showCancelButton: true, inputValidator: (value) => new Promise((res, rej) => value === 'ok' ? res() : rej('must-ok')) })
      .then((v) => { window.__bwCap.resolve = v; outer('s'); }, (r) => { window.__bwCap.reject = r; outer('s'); });
    setTimeout(() => {
      document.querySelector('.swal2-confirm').click();
      setTimeout(() => {
        const err = document.querySelector('.swal2-validationerror');
        const input = document.querySelector('.swal2-input');
        window.__bwCap.v1 = {
          errShown: err && getComputedStyle(err).display !== 'none' && err.textContent === 'must-ok',
          inputErrorClass: input.classList.contains('swal2-inputerror'),
          stillOpen: !!document.querySelector('.swal2-modal'),
        };
        input.value = 'ok';
        document.querySelector('.swal2-confirm').click();
      }, 120);
    }, 60);
  }))()`);
  const cap9 = await evaluate(`window.__bwCap`);
  assert('input-validator-flow', cap9.resolve === 'ok' && cap9.v1 && cap9.v1.errShown && cap9.v1.inputErrorClass && cap9.v1.stillOpen, cap9);

  // ⑩ radio + inputOptions + inputValue 初值
  await evaluate(`(() => new Promise((outer) => {
    window.__bwCap = {};
    window.swal({ html: 'x', input: 'radio', inputValue: 'b', inputOptions: { a: 'Alpha', b: 'Beta' }, showCancelButton: true })
      .then((v) => { window.__bwCap.resolve = v; outer('s'); }, (r) => { window.__bwCap.reject = r; outer('s'); });
    setTimeout(() => {
      const radios = document.querySelectorAll('.swal2-radio input');
      window.__bwCap.r = { count: radios.length, checkedValue: document.querySelector('.swal2-radio input:checked')?.value };
      document.querySelector('.swal2-confirm').click();
    }, 60);
  }))()`);
  const cap10 = await evaluate(`window.__bwCap`);
  assert('radio-inputoptions', cap10.resolve === 'b' && cap10.r && cap10.r.count === 2 && cap10.r.checkedValue === 'b', cap10);

  // ⑪ textarea 显示
  await evaluate(`(() => new Promise((outer) => {
    window.__bwCap = {};
    window.swal({ html: 'x', input: 'textarea', inputValue: 'note', showCancelButton: true })
      .then((v) => { window.__bwCap.resolve = v; outer('s'); }, (r) => { window.__bwCap.reject = r; outer('s'); });
    setTimeout(() => {
      const ta = document.querySelector('.swal2-textarea');
      window.__bwCap.ta = { shown: getComputedStyle(ta).display !== 'none', value: ta.value };
      document.querySelector('.swal2-confirm').click();
    }, 60);
  }))()`);
  const cap11 = await evaluate(`window.__bwCap`);
  assert('textarea-input', cap11.resolve === 'note' && cap11.ta && cap11.ta.shown && cap11.ta.value === 'note', cap11);

  // ⑫ type:'error' icon 显出
  await evaluate(`(() => new Promise((outer) => {
    window.__bwCap = {};
    window.swal({ title: 'boom', text: 'desc', type: 'error', showCancelButton: false, confirmButtonText: 'OK' })
      .then((v) => { window.__bwCap.resolve = v; outer('s'); }, (r) => { window.__bwCap.reject = r; outer('s'); });
    setTimeout(() => {
      const icon = document.querySelector('.swal2-icon.swal2-error');
      window.__bwCap.icon = !!icon && getComputedStyle(icon).display !== 'none';
      document.querySelector('.swal2-confirm').click();
    }, 60);
  }))()`);
  const cap12 = await evaluate(`window.__bwCap`);
  assert('type-error-icon', cap12.resolve === true && cap12.icon === true, cap12);

  // ⑬ 焦点策略：allowEnterKey false → activeElement blur（不等 promise settle——close 不落 then）
  const focusResult = await evaluate(`(() => new Promise((outer) => {
    window.swal({ html: 'x', allowEnterKey: false, focusConfirm: true, showCancelButton: true })
      .then(() => {}, () => {});
    setTimeout(() => {
      const ae = document.activeElement;
      window.swal.close();
      outer(ae === document.body || ae === document.documentElement ? 'BLURRED' : 'FOCUSED:' + (ae && ae.tagName));
    }, 100);
  }))()`);
  assert('allowEnterKey-false-blurs', String(focusResult).indexOf('BLURRED') === 0, focusResult);

  // ⑭ 零 ReferenceError
  const errs = await evaluate(`window.__uxErrors.slice(0, 6)`);
  assert('dialog-zero-reference-errors', errs.length === 0, errs);

'''

s = s[:start] + new_section + s[end:]
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('rewritten OK')
