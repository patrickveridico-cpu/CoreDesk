# CoreDesk — Arquitetura central

## Camadas e processos

O processo `main` é dono do ciclo de vida, sessões persistentes, `WebContentsView`, armazenamento local, permissões, logs e serviços. O `preload` expõe somente contratos IPC explícitos. O renderer React mantém estado visual e metadados de workspace, sem acesso a Node ou ao filesystem.

## Composition root

`electron/core/bootstrap/AppServices.ts` cria `LoggerService`, `EventBus`, `StorageService` por adaptador, `ConfigService`, `PermissionService`, `CommandRegistry` e `WorkspaceService`. O bootstrap é iniciado após `app.whenReady()`, antes da criação da janela, e é encerrado no evento `before-quit`.

Os serviços existentes continuam sendo reutilizados: `WebViewManager` permanece o único proprietário das views; `WhatsAppProfileManager` continua responsável pelo domínio WhatsApp; `WhatsAppProfileStore` agora delega a escrita JSON ao `StorageService` em formato compatível.

## Inicialização e encerramento

1. Electron aguarda `app.whenReady()`.
2. `AppServices` é criado e carrega configurações.
3. IPC, comandos e janela são registrados.
4. `WhatsAppProfileManager` restaura os metadados.
5. O renderer reconcilia tabs e o `WebViewManager` cria as views necessárias.

No encerramento, o EventBus emite `app:before-quit`, views são destruídas pelo `WebViewManager` e os serviços encerram seus recursos.

## Eventos e IPC

O `EventBus` é interno ao main e transporta eventos tipados de janela, workspace, views, WhatsApp, configuração e comandos. Ele não substitui IPC. O renderer conversa com o main somente por APIs tipadas no preload, como `core:get-config`, `core:execute-command` e os canais já existentes de views/WhatsApp.

## Persistência

`StorageService` oferece JSON tipado, diretórios automáticos, escrita atômica, backup de arquivo inválido e recuperação para valores padrão. O `WhatsAppProfileStore` mantém o formato legado `{ version, profiles, activeProfileId }`, preservando profiles e partitions já existentes.

Cookies, credenciais, IndexedDB, Local Storage e mensagens do WhatsApp nunca passam pelo StorageService.

## Permissões

`PermissionService` centraliza a política de sessões: câmera, microfone, localização, notificações e downloads são negados; navegação e novas abas aceitam somente HTTP/HTTPS. `WebViewManager` usa esse serviço para as sessões comuns, Google/Maps e WhatsApp.

## Logs

`LoggerService` grava JSON Lines em `userData/logs/coredesk.log`, mostra console em desenvolvimento, gira o arquivo acima de 2 MB e redige chaves/valores associados a cookies, tokens, credenciais, QR Codes, Local Storage e mensagens.

## Comandos

`CommandRegistry` cataloga comandos com id, título, categoria, atalho e disponibilidade. Comandos de navegação, workspace, WhatsApp, configurações e saída já estão registrados. A migração de atalhos é incremental: os atalhos existentes continuam funcionando e podem encaminhar para os mesmos IDs.

## Workspace e novos módulos

`WorkspaceService` acompanha a aba ativa e um histórico curto, sem criar views nem duplicar Zustand. Novos módulos devem declarar seus comandos, eventos, permissões e persistência; não devem acessar `BrowserWindow`, `session` ou filesystem diretamente no renderer.
