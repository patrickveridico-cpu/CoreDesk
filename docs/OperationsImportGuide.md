# Importação TechRoute

1. O serviço localiza `%APPDATA%/techroute` ou recebe um diretório explícito.
2. `previewImport` lê somente `bases.db`, `insurers.db`, `price_tables.db` e `history.db`.
3. A prévia informa contagens, duplicidades e avisos.
4. `confirmImport` grava um backup dentro do armazenamento CoreDesk e só então persiste os dados normalizados.

Arquivos originais nunca são modificados. Histórico antigo é reportado para revisão porque o formato não contém todos os campos necessários para reconstruir uma rota com segurança.
