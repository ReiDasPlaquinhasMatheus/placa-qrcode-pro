// Placa QR Pro - Componente Reutilizável de Paginação
import { getIcon } from '../utils/icons.js';

export function renderPagination({
  totalItems = 0,
  currentPage = 1,
  perPage = 25,
  entityName = 'plaquinhas',
  idPrefix = 'plaque'
}) {
  const totalPages = Math.ceil(totalItems / perPage) || 1;
  const validCurrentPage = Math.max(1, Math.min(currentPage, totalPages));
  
  const fromIndex = totalItems === 0 ? 0 : (validCurrentPage - 1) * perPage + 1;
  const toIndex = Math.min(validCurrentPage * perPage, totalItems);

  // Geração inteligente de páginas com elipses
  const getPageNumbers = () => {
    const delta = 2; // páginas antes e depois da atual
    const range = [];
    const rangeWithDots = [];

    for (
      let i = Math.max(2, validCurrentPage - delta);
      i <= Math.min(totalPages - 1, validCurrentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (validCurrentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    range.forEach(p => rangeWithDots.push(p));

    if (validCurrentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  const pages = totalPages > 1 ? getPageNumbers() : [1];

  return `
    <div class="pagination-bar" data-prefix="${idPrefix}">
      
      <!-- Resumo Informativo -->
      <div class="pagination-info text-xs text-muted">
        Mostrando <strong class="text-main">${fromIndex}–${toIndex}</strong> de <strong class="text-main">${totalItems}</strong> ${entityName}
        ${totalPages > 1 ? `<span class="hidden sm:inline"> (Página ${validCurrentPage} de ${totalPages})</span>` : ''}
      </div>

      <div class="pagination-controls">
        
        <!-- Seletor de Itens por Página -->
        <div class="pagination-per-page">
          <label for="${idPrefix}-per-page" class="text-xs text-muted font-medium">Exibir:</label>
          <select id="${idPrefix}-per-page" class="form-input pagination-select" data-action="change-per-page">
            <option value="10" ${perPage === 10 ? 'selected' : ''}>10 / pág</option>
            <option value="25" ${perPage === 25 ? 'selected' : ''}>25 / pág</option>
            <option value="50" ${perPage === 50 ? 'selected' : ''}>50 / pág</option>
            <option value="100" ${perPage === 100 ? 'selected' : ''}>100 / pág</option>
          </select>
        </div>

        <!-- Botões de Navegação -->
        ${totalPages > 1 ? `
          <div class="pagination-nav">
            
            <!-- Primeira Página -->
            <button 
              class="btn-pagination-nav btn btn-ghost btn-sm" 
              data-page="1" 
              ${validCurrentPage === 1 ? 'disabled' : ''} 
              title="Primeira Página"
            >
              ${getIcon('chevronsLeft', '', 14)}
            </button>

            <!-- Página Anterior -->
            <button 
              class="btn-pagination-nav btn btn-ghost btn-sm" 
              data-page="${validCurrentPage - 1}" 
              ${validCurrentPage === 1 ? 'disabled' : ''} 
              title="Página Anterior"
            >
              ${getIcon('chevronLeft', '', 14)}
            </button>

            <!-- Páginas Numeradas -->
            <div class="pagination-numbers">
              ${pages.map(p => {
                if (p === '...') {
                  return `<span class="pagination-ellipsis">...</span>`;
                }
                const isActive = p === validCurrentPage;
                return `
                  <button 
                    class="btn-pagination-page btn btn-sm ${isActive ? 'btn-primary active' : 'btn-ghost'}" 
                    data-page="${p}"
                  >
                    ${p}
                  </button>
                `;
              }).join('')}
            </div>

            <!-- Próxima Página -->
            <button 
              class="btn-pagination-nav btn btn-ghost btn-sm" 
              data-page="${validCurrentPage + 1}" 
              ${validCurrentPage === totalPages ? 'disabled' : ''} 
              title="Próxima Página"
            >
              ${getIcon('chevronRight', '', 14)}
            </button>

            <!-- Última Página -->
            <button 
              class="btn-pagination-nav btn btn-ghost btn-sm" 
              data-page="${totalPages}" 
              ${validCurrentPage === totalPages ? 'disabled' : ''} 
              title="Última Página"
            >
              ${getIcon('chevronsRight', '', 14)}
            </button>

          </div>
        ` : ''}

      </div>

    </div>
  `;
}
