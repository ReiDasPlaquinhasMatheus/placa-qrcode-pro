export function renderNavbar(activeRoute = 'lotes') {
  return `
    <header style="background: #FFFFFF; border-bottom: 1px solid #E2E8F0; position: sticky; top: 0; z-index: 50;">
      <div class="container" style="display: flex; align-items: center; justify-content: space-between; height: 60px;">
        
        <!-- Logo -->
        <a href="#/lotes" style="font-weight: 700; font-size: 1.125rem; color: #0F172A; display: flex; align-items: center; gap: 8px;">
          <span>🔲 Placas QR Pro</span>
        </a>

        <!-- Links de Navegação -->
        <nav style="display: flex; align-items: center; gap: 4px;">
          <a href="#/lotes" class="btn ${activeRoute === 'lotes' ? 'btn-primary' : 'btn-ghost'} btn-sm">
            📁 Pastas de Lotes
          </a>
          <a href="#/clientes" class="btn ${activeRoute === 'clientes' ? 'btn-primary' : 'btn-ghost'} btn-sm">
            👥 Clientes
          </a>
          <a href="#/todas-placas" class="btn ${activeRoute === 'todas-placas' ? 'btn-primary' : 'btn-ghost'} btn-sm">
            Todas as Placas
          </a>
          <a href="#/gerador" class="btn ${activeRoute === 'gerador' ? 'btn-primary' : 'btn-ghost'} btn-sm">
            Emitir Lote
          </a>
          <a href="#/ajuda-google" class="btn ${activeRoute === 'ajuda-google' ? 'btn-primary' : 'btn-ghost'} btn-sm">
            Link de Avaliação
          </a>
          <a href="#/config" class="btn ${activeRoute === 'config' ? 'btn-primary' : 'btn-ghost'} btn-sm">
            Configurações
          </a>
        </nav>

        <!-- Ação Rápida -->
        <div style="display: flex; align-items: center; gap: 8px;">
          <a href="#/gerador" class="btn btn-primary btn-sm">
            + Novo Lote
          </a>
        </div>

      </div>
    </header>
  `;
}
