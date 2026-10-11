import { contactKinds, describeContactKinds, findPromiseClaims } from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';
import { CMT } from '@/lib/i18n/strings-commitments';

/**
 * Says, while the person types, what the server would refuse: contact
 * details before both sides confirm, and promised returns anywhere. The
 * server is still the authority; this only saves a round trip and a surprise.
 */
export function ContactWarning({ text, promises = false, id }: { text: string; promises?: boolean; id?: string }) {
  const kinds = contactKinds(text);
  const promised = promises && findPromiseClaims(text).length > 0;
  if (!kinds.length && !promised) return null;
  const what = describeContactKinds(kinds);
  return (
    <div id={id} role="status" className="space-y-1 rounded-lg bg-status-warning-bg px-3 py-2 text-xs text-status-warning">
      {kinds.length ? (
        <p>
          <BilingualText
            en={`${CMT.would_share.en} ${what.en}. Contact details stay out until you both confirm.`}
            el={`${CMT.would_share.el} ${what.el}. Τα στοιχεία επικοινωνίας περιμένουν μέχρι να επιβεβαιώσετε και οι δύο.`}
            wrap
          />
        </p>
      ) : null}
      {promised ? (
        <p>
          <BilingualText
            en="Promised returns cannot be published: the platform organises the decision and does not promise funding or income."
            el="Οι υποσχέσεις αποδόσεων δεν δημοσιεύονται: η πλατφόρμα οργανώνει την απόφαση και δεν υπόσχεται χρηματοδότηση ή εισόδημα."
            wrap
          />
        </p>
      ) : null}
    </div>
  );
}

/** True when the text would be refused for contact details. */
export function hasContactDetails(text: string): boolean {
  return contactKinds(text).length > 0;
}
