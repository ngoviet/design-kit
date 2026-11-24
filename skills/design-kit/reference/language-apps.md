# Language-learning apps: subtitles, sound, words, children

Read with `ux-patterns.md` (type "Learning"). The first two sections are standing decisions of the owner (23–24/11/2026): build
them in from the start. The rest has a source or says it is a convention.

## Listening: subtitles that light up with the sound

- Every listening item has karaoke subtitles: the word being spoken lights up; the line scrolls into view.
- **Two independent switches beside the player**: the original language and the translation ("Tiếng Anh", "Phụ đề tiếng Việt": name the
  language, not "Nghĩa"). Three states must be reachable: original only, translation only, both. With the original off, the translation
  lines still light up, line by line. Phonetics (IPA, pinyin) is a third, optional layer. Remember the choice per person. On a two-column
  screen with these switches beside the player, drop the duplicate row above the transcript.
- Tap a line to replay it. Play, replay, 0.85× and stop are one tap; a second sound stops the first.
- The current word differs by more than color (background, weight, underline) and keeps 4.5:1. With reduced motion, lines change
  without sliding. Theme tokens already keep read/unread text apart (`themes.md`).
- Timing: transcribe, then align to the **original text**; a machine transcript alone puts wrong words on screen. A person listens
  for lead or lag over half a syllable.

## Words

- Every place that shows vocabulary (cards, lists, detail, lookup) has phonetics and a play button per word; replayable, never
  autoplay; a real voice, or a synthetic one in the same accent as the listening items. Children who do not learn phonetics yet
  still get the sound.
- The play button may sit on either side of a card; never automatic, always replayable. (One study: recalling first and then hearing the
  model beat hearing and repeating.)
- Sound and phonetics must be the **same accent**. Check by counting the signs only one accent uses (ɚ, oʊ / əʊ, ɒ) in the data that is
  shown; do not trust the source's label: a British voice was found beside American phonetics.
- Two readings of one spelling (record, produce): show both with the part of speech, and pick the one being taught elsewhere.
- Keep displayed phonetics in their own table when another feature reads the old column (choosing drills, spelling checks): overwriting it
  changes the exercises silently.
- One shared audio element; `play()` rejected because another button was pressed (AbortError) is silence, other errors are shown. Lock the play
  buttons while recording.
- One language per element: `lang="en"`, `lang="zh"`, `lang="zh-Latn-pinyin"`, `lang="en-fonipa"` (`lang-part`). Fields for answers
  turn off autocorrect, autocapitalize and spellcheck.

## Sound and microphone

- No sound and no permission request before the first tap (`autoplay`, `permission`): the context is created or resumed inside the gesture.
- Ask for the microphone when the record button is pressed, after one sentence of why. Denied, absent and not-HTTPS each get their own
  screen that says how to fix it, and another way to do the exercise.
- Recording shows "Đang thu", time and level; stopping releases the microphone; the recording can be heard, redone and deleted.
- iPhone needs a real check: formats differ (choose with `MediaRecorder.isTypeSupported`).

## The session

- One button into step 1; named steps ("Bước 2/5 · Nghe"); a step is ticked only when something was done; "skip today" is a separate,
  blame-free action.
- Wrong answer: the right answer plus one line of why (explained feedback did far better than right/wrong only). One retry. Writing:
  show one or two error kinds, then rewrite.
- A daily cap on review cards; after a break, debt is paid silently; a weekly goal with days off instead of a streak that resets.
- The end screen says what was learned and what comes tomorrow, and does not move on by itself.
- Never: hearts, streak-loss warnings, ranking inside a family, autoplay of the next lesson.

## Children and shared devices

- Nothing that works **only** by dragging, double tap, long press or pinch; dragging to a big target with a tap alternative is fine.
- Instructions as picture and voice, clear with the sound off. Three choices at a time (convention).
- Wrong: hint, retry, right answer; no big red X, no buzzer.
- Ages 8–12: touch targets of 52 px (`--touch 52`), a convention from NN/g's 1 cm. No special size for 6-year-olds (owner, 24/11/2026).
- Shared device: ask who is learning on open and after idle; picture and color per person; a session recorded under the wrong person can
  be moved.
- Test with real children: they do three tasks alone, you write every stop over 5 seconds.

Evidence with quotes: research topic `trai-nghiem-hoc-trong-app-ngoai-ngu-cho-gia-dinh`; subtitle method and code:
`to-sang-chu-theo-audio-phu-de-karaoke-cho-hoc-ngoai-ngu` (owner's knowledge base). Evidence at age 6 is thin.
