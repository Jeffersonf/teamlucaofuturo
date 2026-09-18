// modules/settings.js - Módulo de configurações da escola, preferências visuais e Pix da Arena
'use strict';

import { api } from './api.js';

/**
 * Renderiza a página de configurações
 */
export async function renderSettings(ctx, { syncForm = true } = {}) {
  const picker = document.getElementById('themePicker');
  if (!picker) return;
  const current = 'dark';
  const renderTheme = (item) => `
    <button class="theme-choice ${item.id === current ? 'is-active' : ''}" type="button" role="option" aria-selected="${item.id === current}" data-theme-choice="${item.id}">
      <span class="theme-choice-preview" aria-hidden="true">
        <i style="--theme-swatch:${item.swatches[0]}"></i><i style="--theme-swatch:${item.swatches[1]}"></i><i style="--theme-swatch:${item.swatches[2]}"></i>
      </span>
      <span class="theme-choice-copy"><strong>${item.label}</strong><small>${item.description}</small></span>
      <span class="theme-choice-check" aria-hidden="true">${item.id === current ? '✓' : ''}</span>
    </button>`;
  picker.innerHTML = `<div class="theme-choice-grid">${ctx.THEME_OPTIONS.map(renderTheme).join('')}</div>`;
  if (syncForm) {
    syncSettingsForm(ctx);
    await loadPixConfig(ctx);
  }
  updateSettingsPreview(ctx);
}

/**
 * Sincroniza os campos do formulário com as configurações salvas
 */
export function syncSettingsForm(ctx) {
  document.querySelectorAll('[data-settings-field]').forEach((field) => {
    const value = ctx.appConfig[field.dataset.settingsField] || '';
    field.value = value;
  });
}

/**
 * Lê os valores preenchidos no formulário de configurações
 */
export function readSettingsForm(ctx) {
  const next = { ...ctx.appConfig };
  document.querySelectorAll('[data-settings-field]').forEach((field) => {
    next[field.dataset.settingsField] = field.value.trim();
  });
  return next;
}

/**
 * Atualiza a prévia ao vivo de textos e identidade visual
 */
export function updateSettingsPreview(ctx) {
  const getValue = (id, fallback) => document.getElementById(id)?.value.trim() || fallback;
  const brand = getValue('settingsBrandName', ctx.appConfig.brandName);
  const subtitle = getValue('settingsBrandSubtitle', ctx.appConfig.brandSubtitle);
  const title = getValue('settingsDashboardTitle', ctx.appConfig.dashboardTitle);
  const description = getValue('settingsPublicDescription', ctx.appConfig.publicDescription);
  document.querySelectorAll('[data-preview-brand]').forEach((el) => { el.textContent = brand; });
  document.querySelectorAll('[data-preview-subtitle]').forEach((el) => { el.textContent = subtitle; });
  document.querySelectorAll('[data-preview-title]').forEach((el) => { el.textContent = title; });
  document.querySelectorAll('[data-preview-description]').forEach((el) => { el.textContent = description; });
}

/**
 * Carrega a configuração Pix da Arena do backend
 */
export async function loadPixConfig(_ctx) {
  try {
    const res = await api('/api/pix/config');
    if (res && res.ok) {
      const keyInput = document.getElementById('settingsPixKey');
      const typeInput = document.getElementById('settingsPixType');
      const benInput = document.getElementById('settingsPixBeneficiary');
      const cityInput = document.getElementById('settingsPixCity');
      if (keyInput) keyInput.value = res.chave_pix || '';
      if (typeInput) typeInput.value = res.tipo_chave || 'telefone';
      if (benInput) benInput.value = res.beneficiario || '';
      if (cityInput) cityInput.value = res.cidade || 'Sorocaba';
    }
  } catch (err) {
    console.warn('Não foi possível carregar configuração Pix remota:', err);
  }
}

/**
 * Salva a configuração Pix da Arena no backend
 */
export async function savePixConfig(ctx) {
  const keyInput = document.getElementById('settingsPixKey');
  const typeInput = document.getElementById('settingsPixType');
  const benInput = document.getElementById('settingsPixBeneficiary');
  const cityInput = document.getElementById('settingsPixCity');
  if (!keyInput) return;

  try {
    const payload = {
      chave_pix: keyInput.value.trim(),
      tipo_chave: typeInput?.value || 'telefone',
      beneficiario: benInput?.value.trim() || 'Team Lucão Futevôlei',
      cidade: cityInput?.value.trim() || 'Sorocaba'
    };
    const res = await api('/api/pix/config', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res && res.ok) {
      ctx.toast('Configuração Pix da Arena atualizada no servidor');
    }
  } catch (err) {
    console.error('Erro ao salvar Pix config:', err);
  }
}

/**
 * Salva as configurações locais e remotas
 */
export async function saveSettings(ctx, event) {
  if (event) event.preventDefault();
  ctx.setAppConfig(readSettingsForm(ctx));
  localStorage.setItem(ctx.CONFIG_KEY, JSON.stringify(ctx.appConfig));
  ctx.applyAppConfig();
  ctx.updateSystemNotice();
  await savePixConfig(ctx);
  renderSettings(ctx);
  ctx.toast('Ajustes salvos com sucesso!');
}

/**
 * Descarta alterações e restaura formulário
 */
export function resetSettingsForm(ctx) {
  syncSettingsForm(ctx);
  loadPixConfig(ctx);
  updateSettingsPreview(ctx);
  ctx.toast('Alterações descartadas');
}
