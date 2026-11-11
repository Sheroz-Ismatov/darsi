import type { InviteLinkResponse } from '@darsi/shared';
import { Button, Dialog, Input } from '@darsi/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface InviteLinkDialogProps {
  title: string;
  /** Whom to send it to and until when; the caller formats the date in the right time zone. */
  text: string;
  invite: InviteLinkResponse;
  onClose: () => void;
}

/** Shows a freshly issued one-time invite link with a copy button (owner and staff invites). */
export function InviteLinkDialog({ title, text, invite, onClose }: InviteLinkDialogProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(invite.url).then(() => setCopied(true));
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      closeLabel={t('inviteLink.close')}
      footer={<Button onClick={onClose}>{t('inviteLink.done')}</Button>}
    >
      <p className="mt-0 mb-4 text-ink-2">{text}</p>
      <div className="flex gap-2">
        <Input
          readOnly
          value={invite.url}
          aria-label={title}
          className="font-mono text-[13px]"
          onFocus={(event) => event.target.select()}
        />
        <Button variant="lime" className="shrink-0" onClick={copy}>
          {t(copied ? 'inviteLink.copied' : 'inviteLink.copy')}
        </Button>
      </div>
      <p className="mt-3 mb-0 text-xs text-muted">{t('inviteLink.once')}</p>
    </Dialog>
  );
}
