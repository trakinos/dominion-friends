import { Icon } from './Icon';

interface Props {
  title: string;
  body: string;
  cancel: string;
  confirm: string;
  onCancel(): void;
  onConfirm(): void;
  tone?: 'danger' | 'neutral';
}

/** A small confirmation, styled like the prompt dialog. */
export function ConfirmDialog({ title, body, cancel, confirm, onCancel, onConfirm, tone = 'danger' }: Props) {
  return (
    <div className="overlay" role="alertdialog" aria-modal="true" aria-label={title} onClick={onCancel}>
      <div className="prompt prompt--confirm panel" onClick={(e) => e.stopPropagation()}>
        <div className="sig">
          <Icon name={tone === 'danger' ? 'x' : 'alert'} />
        </div>
        <h2>{title}</h2>
        <p className="muted">{body}</p>
        <div className="actions actions--center">
          <button type="button" autoFocus onClick={onCancel}>
            {cancel}
          </button>
          <button type="button" className={tone === 'danger' ? 'danger-fill' : 'primary'} onClick={onConfirm}>
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
