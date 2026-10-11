# Domain UI/UX review — auth, settings, admin analytics

## Scope and method

Read `AGENTS.md`, inspected the auth forms, settings pages (account, billing, notifications, AI, export), two-factor components, and `AdminAnalyticsDashboard`. Ran `node scripts/platform-inventory.cjs --summary`: 985 source files, 160 route candidates, 197 boundaries, 3,841 surface candidates, 533 endpoint candidates, **0 verified** and 0 parse errors. Those numbers describe static inventory, not tested accessibility or working routes. This review does not claim a browser-wide audit of those candidates. Shared `components/ui`, `components/layout` and `globals.css` are outside this change's ownership.

## Confirmed findings and changes

| Severity | Evidence / user impact | WCAG mapping | Resolution |
| --- | --- | --- | --- |
| High | Billing contact's seven visible `Label` elements had no `htmlFor`, and their inputs had no IDs. Placeholder text vanished on entry; assistive technology could not reliably discover each input's purpose. | 1.3.1 Info and Relationships; 3.3.2 Labels or Instructions; 4.1.2 Name, Role, Value | Connected each existing label to its input in `/settings/billing`. |
| High | Account password change used only placeholders for current, new and confirmation fields. The fields lost their visible hint after typing and had no persistent programmatic names. | 3.3.2; 4.1.2 | Added visually hidden bilingual labels associated with each field in `/settings`. |
| High | Two-factor verification code fields had adjacent labels with no association, so the numeric placeholders were their only input hints. | 1.3.1; 3.3.2; 4.1.2 | Associated both setup and disable labels with their inputs. |
| Medium | Register password visibility button explicitly used `tabIndex={-1}`, preventing keyboard users from reaching a working control. | 2.1.1 Keyboard | Restored native keyboard focus; kept its existing accessible name and behavior. |
| Medium | Reset password confirmation showed a mismatch visually, but did not expose invalid state or link the message to its field; submission errors were not announced. | 3.3.1 Error Identification; 3.3.3 Error Suggestion; 4.1.3 Status Messages | Added invalid state and described-by on affected fields, associated the mismatch text, and made the submit error an alert. |
| Medium | Admin analytics' loading text had no status role and its failed fetch displayed a plain text error; the retry button sat inline in a potentially long API error. | 4.1.3 Status Messages; 3.3.1 | Added loading status and error alert, kept the real API error and retry/refresh operations, provided visible keyboard focus styling. |

## Verification and limits

Focused adjacent jsdom tests cover the admin loading/error/retry/refresh transition and reset mismatch association (`AdminAnalyticsDashboard.test.tsx`, `reset-password/page.test.tsx`); both passed. This does not verify browser layout, color contrast, real screen-reader speech, Greek locale rendering, 2FA/backend persistence, or every branch of authentication and billing. The account/billing/2FA changes were source-inspected, not interaction-tested. The analytics charts and some explanatory strings remain English-only in this component; this review did not invent Greek copy or change chart encodings. The inventory's remaining routes, controls and API declarations require separate rendered and manual review; absence from this report is not a pass.