import { useEffect, useState } from 'react'
import { Minus, Square, X, Copy } from 'lucide-react'

const buttonClass = 'window-interactive grid h-10 w-11 place-items-center text-slate-400 transition-colors hover:bg-white/5 hover:text-white'

export function WindowControls() {
  const [maximized, setMaximized] = useState(false)
  const windowApi = window.coreDesk?.window

  useEffect(() => {
    if (!windowApi) return
    void windowApi.isMaximized().then(setMaximized)
    return windowApi.onMaximizedChange(setMaximized)
  }, [windowApi])

  if (!windowApi) return null

  return (
    <div className="window-interactive ml-auto flex shrink-0" aria-label="Controles da janela">
      <button className={buttonClass} onClick={windowApi.minimize} aria-label="Minimizar"><Minus size={15} /></button>
      <button className={buttonClass} onClick={windowApi.toggleMaximize} aria-label={maximized ? 'Restaurar' : 'Maximizar'}>
        {maximized ? <Copy size={13} /> : <Square size={13} />}
      </button>
      <button className={`${buttonClass} hover:bg-red-500 hover:text-white`} onClick={windowApi.close} aria-label="Fechar"><X size={16} /></button>
    </div>
  )
}
