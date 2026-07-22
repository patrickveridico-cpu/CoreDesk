# Arquitetura de Operações

O módulo vive em `src/modules/operations` e usa a aba interna `routes` já existente. O renderer acessa apenas a API `operations` do preload. O main compõe `OperationsService` no `AppServices`; o serviço usa `StorageService`, `LoggerService` e `EventBus`.

Dados operacionais ficam inicialmente em JSON versionado (`operations/operations.json`). A quantidade observada e o padrão de consultas não justificam SQLite nesta etapa. Escritas são atômicas e o importador cria um snapshot de backup antes de confirmar.

Google Maps permanece como aba real do CoreDesk. A distância da primeira versão é manual, com origem explicitamente indicada. Nenhum script é injetado no Maps e nenhuma mensagem é enviada automaticamente ao WhatsApp.
