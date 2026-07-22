import { SHELL_LAYOUT } from '../../shared/layout'
import brandSymbol from '../../assets/brand/derived/coredesk-symbol-32.png'
import { WindowControls } from './WindowControls'

export function TitleBar() {
  return (
    <header data-testid="coredesk-titlebar" data-debug="coredesk-titlebar" className="window-drag relative z-[100] flex shrink-0 items-center border-b border-core-line bg-core-panel text-slate-100" style={{ height: SHELL_LAYOUT.titleBarHeight }}>
      <div className="flex h-full w-36 shrink-0 items-center gap-2 px-3 text-sm font-semibold tracking-wide text-slate-100">
        <img src={brandSymbol} alt="" className="h-[18px] w-[18px] rounded-sm" />
        CoreDesk
      </div>
      <div className="min-w-0 flex-1" aria-hidden="true" />
      <WindowControls />
    </header>
  )
}
