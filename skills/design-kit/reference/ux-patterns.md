# UX patterns: which flow for which kind of web page

Read this when you start a page, app or flow, before markup. It adds the layer the thresholds do not cover: which steps
people go through, where they get stuck, what to do there. Looks and measured rules stay in `docs/tieu-chi.md`.

How to use it: answer the 8 questions (2 minutes) → read the 1–2 page types that match → write the task map, one pattern
code per hesitation point → build from the block named on the pattern → turn each *check* into a step of
`<page>.steps.json` → try it with 1–3 people and write down where they stall.

Strength: **S** strong (several studies), **M** medium (one study with a described sample), **W** weak (vendor guidance or
convention). The four-layer structure and the pattern list are a working hypothesis: no experiment was found showing that a
pattern library makes users finish more. Evidence with quotes: research topic `bo-ux-dung-chung-cho-cac-loai-web-theo-viec-nguoi-dung`
(24/11/2026, owner's knowledge base).

## Eight questions

| Question | Yes → patterns |
| --- | --- |
| More than 3 steps, or more than 12 fields? | M05 M06 M07 |
| Often interrupted, or a shared device? | M06 M03 |
| Can an action lose data, cost money or send something out? | M20 M10 |
| Any wait over 1 s, or data from another machine or network? | M17 M18 |
| Used every day, for a long time? | M23 M25 M12 |
| Visitors who never saw it, or do not trust it yet? | M01 M02 M04 |
| Children, or people who cannot read well yet? | M26 M03 M25 |
| AI that answers or acts? | M29 M30 M31 |

## Core: twelve things every screen must do

1. The first screen answers "what do I do first": one main button that names the task.
2. Show a result before asking for an account, a phone number, a permission.
3. Typed text never disappears: error, Back, reload, tab or person switch, session end.
4. Stop anywhere and come back to the same spot; progress belongs to the person, not the machine.
5. Back closes the open layer first; filters, sort and scroll survive coming back.
6. No dead ends: empty, error, no match, all done; each has one next action.
7. Say the true state: saving, saved, not sent, how old a number is. Unknown is said as unknown.
8. Undo first, ask last; ask only for rare, irreversible things and name what will be lost.
9. An error says how to fix it, beside the mistake. Wrong → block and keep the value; odd but possible → ask and let pass.
10. Ask only what is needed now; prefill what is known. A wrong default hurts more than an empty field.
11. A clear end: what was done, what comes next. The end screen stays put.
12. Notify little, in time, switchable off. Things that need a click stay in place.

## Never

Fees or conditions revealed at the last step · refusing harder than accepting, cancelling harder than joining · fake
scarcity, countdowns, counts or praise · guilt or loss threats in learning, play and children's products · autoplay of the
next item, pleading characters or random rewards for children · consent by default or bundled · invented content as filler
(`data-assumed`, SKILL §2c).

## Page types

| Type | Main jobs | Breaks most | Patterns | Avoid |
| --- | --- | --- | --- | --- |
| Landing, service, portfolio | what is it, can I trust it, price, contact | first 10 s; hidden price | M04 M02 M15 | button-color tuning |
| Article, report | what it says, jump to a part | collapsing what everyone needs; TOC only in a side column | M15 M11 | cutting text because "mobile does not read" |
| Docs, help, search | fix my error, follow it | no result = dead end; code that cannot be copied | M11 M29 M15 | a generic chat bubble |
| Shop | the right item, total, delivery | late fees, forced account, cleared card number | M10 M12 M04 M06 | one-page form just to have fewer steps |
| Form, sign-up, booking | send once, keep the slot, change it | removing the wrong field | M05–M09 | branching accordions, six OTP boxes, passkey only |
| Single-job tool | right result, why, take it away | wrong defaults; sign-up before the result | M16 M07 | sliders for exact numbers, `type=number` for money |
| Admin, SaaS | find, compare, edit, act on many | dialog hides the data being compared; page vs all selected | M12 M13 M14 M20 M18 | "Are you sure?" that names nothing |
| Dashboard, smart home | is anything wrong, where, act and know it took | stale numbers shown as fresh; alarm fatigue | M22 M21 M19 M18 M03 | hiding a page and calling it permissions |
| Learning | what today, feedback on the right thing, stop and resume | not resuming; only right/wrong | M24 M25 M23 M26 M06 M03 M17 | hearts, streak reset to 0, ranking; see `language-apps.md` |
| Community, chat | what is happening, one small act, safety | newcomers get no answer; reports vanish | M27 M28 M18 M21 | real-name rule, "last seen" |
| AI assistant, agent | clear task, check and fix, delegate safely | believing explained errors; reflex approval | M29 M30 M31 M17 M20 | long logs as oversight, approvals all at the end |
| Watch, listen, 3D | continue, find, look around | stuck in a zoomed view | M32 M25 M18 | blocking intro for what can be explored |

## Patterns

- **M01 First open** (M) one thing to do now; "Bắt đầu" list of 3–5 real tasks that ticks itself. Not a blocking tour. Check: a newcomer finishes the first task alone. `bat-dau`, `trang-thai`
- **M02 Too many ways** (M) labels by task, one main path, search always visible. Check: first-click test, 3 people × 5 tasks. `dau-trang`, `thanh-ben`
- **M03 Shared device** (M) ask "who?" on open, after idle, at the end; each person a picture and color, name on every screen; move a session recorded under the wrong person. Not on private devices.
- **M04 Not trusted yet** (W) price or range, call/message/form side by side with reply time, sources and dates. No security badges. `hero`
- **M05 Long one-off task** (M) named steps, next button names the next step, review page whose Edit returns to review. Short repeated forms: one grouped page. `trinh-tu`
- **M06 Interrupted** (W) draft saved per person with "saved at…", reopen at the same step. Sensitive data on a shared device: ask first. `trinh-tu`
- **M07 What do I type** (W) real example beside the field; wrong blocks, odd asks; numbers are text fields with a numeric keyboard. `form-dang-nhap`
- **M08 Prove who you are** (M) one OTP box that accepts paste; code not link by SMS; offer a passkey after sign-in, never as the only way. `form-dang-nhap`
- **M09 Booking** (S) full slots dimmed, not hidden; confirmation says day, time, place, bring what; reminders carry Move and Cancel. `trinh-tu`
- **M10 Checkout** (M) total with fees from the product page; guest first; review before placing; order page with code and date. `trinh-tu`
- **M11 Cannot find it** (M) no-result gives a way on; match without diacritics, rank exact first; say the search scope. `bo-loc`
- **M12 Long list** (M) "filtering by" bar always visible; Back keeps filters and scroll; paginate to find again, scroll to browse. `bo-loc`, `bang-du-lieu`
- **M13 Edit one, compare another** (W) side panel that does not cover the table; two editors: both versions, none preselected. `bang-du-lieu`
- **M14 Act on many rows** (W) "12 of 1,240 selected"; this page vs all results; a result list of done, failed and why. `bang-du-lieu`
- **M15 Long text** (M) 2–4 point summary, headings that state the point, sections open on phones. `bai-viet`
- **M16 One number to understand and take** (W) updates in place, "how it is computed" with source and date, copy and share link. `chi-so`
- **M17 Wait over 1 s** (M) which step, how long; disable the pressed button; Stop; let people do something else. Under 1 s: silence. `trang-thai`
- **M18 Offline, stale data** (W) keep the content, show its age, lock only what needs the network, unsent items get Retry. `trang-thai`
- **M19 Did the device get it** (W) locks, gates, pumps: never "done" before the device confirms; mute devices get On and Off buttons, not a switch.
- **M20 Slip of the hand** (M) easy to redo: do it, keep Undo; costly: ask and name it; chain reaction: type the name. Undo sits beside the change (a toast is gone before some people reach it); the kit's `thong-bao` keeps it in the toast for deletions. `thong-bao`, `hop-thoai`, `chon-mau`
- **M21 Too many alerts** (M) three levels; thresholds with hysteresis; repeat less, stop when someone takes it; "mute until". Never batch smoke, gas, water, intrusion. `thong-bao`
- **M22 One glance** (M) quiet when normal, the odd one speaks in words; find by room or dependency; show data age. `chi-so`
- **M23 Keep a rhythm without pressure** (M) weekly goal with days off; a part counts; after a long break an ordinary session, debt paid silently; one shared bar, no ranking.
- **M24 Wrong: why** (S) the right answer plus one line of why; one retry first; praise the act, not the person.
- **M25 End and let go** (M) what was done and what is next; stop at natural points; invite the next person on a shared device. `trang-thai`
- **M26 Cannot read well yet** (M) instructions as picture and voice, clear with the sound off; three choices (convention); everyday verbs; nothing that works only by dragging, double tap or long press.
- **M27 First time among others** (M) short rules beside the editor, one small concrete act, empty room shows the next meeting.
- **M28 Bad people, bad posts** (M) mute, block, report in one menu; reports get an answer.
- **M29 Trust an AI answer** (M) source beside the sentence, pointing at the passage; say what is unsure; sample-check by a person.
- **M30 AI acts for you** (M) two questions: can it be undone, do outsiders see it; preview what will be sent or deleted; a few approvals along the way; log with Undo.
- **M31 Fix an AI result** (M) select a part, then command; frequent commands as buttons; retry, previous version and dismiss beside the result.
- **M32 Watch, listen, 3D** (M) continue first, autoplay off, captions one tap and remembered; 3D has pictures and text and a Home view.

## Vietnamese layer

Cash on delivery offered, not preselected · VietQR on the same phone: open-bank button, save image, copy account and memo ·
two-level addresses since 1/7/2025: search old and new names, let the person decide · a phone number is contact, not identity ·
one full-name field · 1.250.000 ₫ and dd/mm/yyyy · search without diacritics, never validate while a tone mark is being typed ·
Zalo is one channel, with call and form · one box per consent purpose, silence is not consent.
