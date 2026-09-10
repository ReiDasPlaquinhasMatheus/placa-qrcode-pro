import { getIcon } from '../utils/icons.js';

export function renderGoogleReviewHelper() {
  return `
    <div class="container py-8" style="max-width: 760px;">
      
      <!-- Cabeçalho -->
      <div class="mb-6">
        <a href="#/lotes" class="text-xs text-muted mb-2 inline-flex items-center hover:text-blue" style="gap: 4px;">
          ${getIcon('arrowLeft', '', 12)}
          <span>Voltar para Pastas de Lotes</span>
        </a>
        <h1 style="font-size: 1.5rem; display: flex; align-items: center; gap: 8px;">
          ${getIcon('star', '', 24)}
          <span>Como Obter o Link Direto de Avaliação</span>
        </h1>
        <p class="text-sm text-muted mt-1">Gere o link oficial do Google que já abre a caixa de avaliação com 5 estrelas.</p>
      </div>

      <!-- Testador Rápido de Link -->
      <div class="card p-6 mb-6">
        <h2 style="font-size: 1rem; margin-bottom: 0.5rem;">Testador e Formatador de Link</h2>
        <p class="text-xs text-muted mb-4">Cole o link que você tem ou o Place ID para formatar o link de avaliação:</p>

        <div class="form-group">
          <label class="form-label" for="helper-input-url">Link do Google ou Place ID</label>
          <input 
            type="text" 
            id="helper-input-url" 
            class="form-input" 
            placeholder="Cole aqui (ex: https://maps.app.goo.gl/... ou ChIJN1t_tDeuEmsR... ou @empresa)" 
          />
        </div>

        <div id="helper-result-box" class="hidden p-3 mt-4" style="background: var(--bg-subtle); border-radius: 6px;">
          <span class="text-xs text-muted block mb-1 font-medium">Link Formatado:</span>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="helper-generated-link" class="form-input font-mono text-xs" readonly />
            <button id="btn-copy-helper-link" class="btn btn-primary btn-sm" style="white-space: nowrap;">
              Copiar
            </button>
            <a id="btn-test-helper-link" href="#" target="_blank" class="btn btn-secondary btn-sm" style="white-space: nowrap;">
              Testar
            </a>
          </div>
        </div>
      </div>

      <!-- Passo a Passo Simples -->
      <div class="card p-6">
        <h2 style="font-size: 1rem; margin-bottom: 1rem;">Como pegar o link pelo Google Meu Negócio</h2>
        <ol class="text-sm text-main" style="padding-left: 1.25rem; line-height: 1.8;">
          <li>Acesse o <strong>Google</strong> logado na conta da empresa.</li>
          <li>Pesquise por <strong>"Meu Negócio"</strong> na barra de pesquisa.</li>
          <li>Clique no botão <strong>"Pedir avaliações"</strong>.</li>
          <li>Copie o link curto fornecido (exemplo: <code class="font-mono text-blue">https://g.page/r/.../review</code>).</li>
          <li>Cole esse link no QR Code desejado.</li>
        </ol>
      </div>

    </div>
  `;
}
