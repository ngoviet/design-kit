// Fixture của design-kit check-mod: một thanh trên ô nhập cố ý mắc mỗi lỗi một lần (test/check-mod.test.ts).
//   svg-terminal  `'Svg' in ui` đúng cả trên terminal (Svg vẽ thành hộp rỗng), nên ký hiệu dự phòng không hiện
//   contrast      #4caf6e trên terminal sáng: 2,74:1
//   hard-color    #4caf6e cố định; "ok" tô bằng khoá theme `success` thì không bị báo
//   overflow      nhãn flexShrink 0 dài hơn 40 cột
//   text-cut      ghi chú wrap="truncate-end" bị cắt khi hẹp
//   svg-source    hình lớn không có alt
//   text-min      chữ 10px trong hình lớn
//   motion        @keyframes không có prefers-reduced-motion
import type { Register } from 'claude-code'

const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="none" stroke="#5fa8d3" stroke-width="2"/></svg>'
const BIG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" width="120" height="40"><style>.p{animation:p 1s infinite}@keyframes p{50%{opacity:.3}}</style><rect class="p" width="120" height="40" rx="6" fill="#1d4f73"/><text x="8" y="24" font-size="10" fill="#ffffff">tiny label</text></svg>'

export const register: Register = (on, options) => {
  const vi = options.language === 'vi'
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    const Svg = 'Svg' in ui ? ui.Svg : null
    return (
      <Box flexDirection="row" columnGap={1}>
        {Svg ? <Svg source={ICON} alt="cache" width={18} height={18} /> : <Text>⧗</Text>}
        <Text color="#4caf6e">$0.50</Text>
        <Text color="success">{vi ? 'ổn' : 'ok'}</Text>
        <Box flexShrink={0}>
          <Text>{vi ? 'nhãn cố định không co được, rộng hơn bốn mươi ô' : 'a fixed label that never shrinks, wider than forty cells'}</Text>
        </Box>
        <Text wrap="truncate-end">{vi ? 'ghi chú dài bị cắt khi thanh hẹp lại' : 'a long note that gets cut when the band is narrow'}</Text>
        {Svg ? <Svg source={BIG} alt="" width={120} height={40} /> : null}
      </Box>
    )
  })
}
