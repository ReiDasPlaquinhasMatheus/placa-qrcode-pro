export function renderNavbar(activeRoute = 'lotes') {
  return `
    <header style="background: #FFFFFF; border-bottom: 1px solid #E2E8F0; position: sticky; top: 0; z-index: 50;">
      <div class="container" style="display: flex; align-items: center; justify-content: space-between; height: 60px;">
        
        <!-- Logo -->
        <a href="#/lotes" style="font-weight: 800; font-size: 1.125rem; color: #0F172A; display: flex; align-items: center; gap: 10px; text-decoration: none;">
          <img src="/logo.png" alt="Rei do NFC" style="height: 38px; width: 38px; object-fit: contain; filter: drop-shadow(0 2px 6px rgba(37,99,235,0.3));" />
          <div style="display: flex; align-items: baseline; gap: 6px;">
            <span style="font-weight: 800; color: #0F172A; font-size: 1.05rem; letter-spacing: -0.01em;">REI DO NFC</span>
            <span style="font-size: 0.6875rem; color: #2563EB; font-weight: 700; text-transform: uppercase;">Placas Pro</span>
          </div>
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
