import type { CoreDeskApi } from '../../shared/contracts'

export {}

declare global {
  interface Window {
    coreDesk?: CoreDeskApi
  }
}
