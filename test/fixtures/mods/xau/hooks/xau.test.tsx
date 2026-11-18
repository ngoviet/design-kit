// Test của mod fixture: check-mod đổi import này sang lớp chặn và quét lần mount bên dưới.
import { expect, test } from 'claude-code/testing'

const band = { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 4, bodyColumns: 120, scroll: { offset: 0, bodyRows: 4 }, view: {} }

test('the band shows the cost', async ($) => {
  const ui = await $.ui.mount({ plugin: 'xau', surface: 'terminal', component: 'AbovePrompt', props: band })
  expect(await ui.find({ type: 'Text', text: /^\$0\.50$/ })).toBeDefined()
  await ui.unmount()
})
