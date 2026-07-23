import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ConflictTablePage } from '../src/modules/operations/pages/ConflictTablePage'
import { EntityMaintenancePanel } from '../src/modules/operations/components/EntityMaintenancePanel'
import { emptyOperationsData } from '../shared/operations/schemas'

describe('layout dos módulos de Operações', () => {
  it('renderiza Tabelas como conteúdo específico, sem uma segunda navegação de Operações', () => {
    const markup = renderToStaticMarkup(createElement(ConflictTablePage))
    expect(markup).toContain('Tabelas de Preço')
    expect(markup).toContain('class="w-full')
    expect(markup).not.toContain('operations-top-navigation')
    expect(markup).not.toContain('aria-label="Operações"')
  })

  it('expõe as ações de criação de Seguradora e Tabela com rótulos acessíveis', () => {
    const insurers = renderToStaticMarkup(createElement(EntityMaintenancePanel, { section: 'insurers', snapshot: emptyOperationsData(), onReload: () => undefined }))
    const tables = renderToStaticMarkup(createElement(ConflictTablePage))
    expect(insurers).toContain('aria-label="Adicionar Seguradora"')
    expect(insurers).toContain('Adicionar Seguradora')
    expect(tables).toContain('aria-label="Adicionar Tabela"')
    expect(tables).toContain('Adicionar Tabela')
  })
})
