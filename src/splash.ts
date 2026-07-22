import brandLogo from '../assets/brand/CoreDesk-logo-conceito.png'
import './splash.css'

document.getElementById('splash-root')!.innerHTML = `
  <main class="splash">
    <img src="${brandLogo}" alt="CoreDesk Operational Workspace" />
    <div class="loading"><span></span></div>
    <p>Inicializando núcleo operacional</p>
  </main>
`
