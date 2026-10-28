import { h, iconEl, type Child } from './dom';

export interface DialogOptions {
  titleKo: string;
  descriptionKo?: string;
  content?: Child[];
  confirmLabelKo: string;
  cancelLabelKo?: string;
  danger?: boolean;
  pulse?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

let dialogCount = 0;

export function openDialog(options: DialogOptions): HTMLDialogElement {
  dialogCount += 1;
  const titleId = `dialog-title-${dialogCount}`;
  const messageId = `dialog-message-${dialogCount}`;

  const dialog = h('dialog', {
    className: 'modal',
    attrs: { 'aria-labelledby': titleId, 'aria-describedby': messageId },
  });

  const close = (): void => {
    if (dialog.open) {
      dialog.close();
    }
  };

  const cancelButton = options.cancelLabelKo
    ? h(
        'button',
        {
          className: 'btn btn-secondary',
          attrs: { type: 'button' },
          on: {
            click: () => {
              options.onCancel?.();
              close();
            },
          },
        },
        options.cancelLabelKo,
      )
    : null;

  const confirmButton = h(
    'button',
    {
      className: `btn ${options.danger ? 'btn-danger' : 'btn-primary'} ${
        options.pulse ? 'btn-pulse' : ''
      }`.trim(),
      attrs: { type: 'button' },
      on: {
        click: () => {
          options.onConfirm();
          close();
        },
      },
    },
    options.confirmLabelKo,
  );

  const panel = h(
    'div',
    { className: 'modal-panel' },
    h(
      'div',
      { className: 'modal-head' },
      h('p', { className: 'modal-kicker' }, 'WaveWorks'),
      h('h2', { id: titleId }, options.titleKo),
      dialogCancelButton(close),
    ),
    options.descriptionKo
      ? h('p', { className: 'modal-description', id: messageId }, options.descriptionKo)
      : h('p', { className: 'sr-only', id: messageId }, options.titleKo),
    options.content ? h('div', { className: 'modal-content' }, ...options.content) : null,
    h('div', { className: 'modal-actions' }, cancelButton, confirmButton),
  );

  dialog.append(panel);
  document.body.append(dialog);

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    options.onCancel?.();
    close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      close();
    }
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
  });

  dialog.showModal();
  (options.danger && cancelButton ? cancelButton : confirmButton).focus();
  return dialog;
}

function dialogCancelButton(close: () => void): HTMLButtonElement {
  return h(
    'button',
    {
      className: 'icon-btn modal-close',
      attrs: { type: 'button', 'aria-label': '닫기' },
      on: { click: close },
    },
    iconEl('close', 20),
  );
}
